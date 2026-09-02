package database

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"sync"
	"time"
)

var auditMu sync.Mutex

// RecordAuditEvent appends a hash-chained event. Configure AUDIT_HMAC_KEY in
// production; without that secret, an attacker who can alter the database can
// recreate hashes, so OS-level access control remains required.
func RecordAuditEvent(userID int64, username, action, resource, detail string) error {
	auditMu.Lock()
	defer auditMu.Unlock()

	var previous string
	_ = DB.QueryRow("SELECT event_hash FROM audit_events ORDER BY id DESC LIMIT 1").Scan(&previous)
	now := time.Now().UTC().Format(time.RFC3339Nano)
	payload := fmt.Sprintf("%s|%d|%s|%s|%s|%s|%s", previous, userID, username, action, resource, detail, now)
	key := []byte(os.Getenv("AUDIT_HMAC_KEY"))
	if len(key) == 0 {
		key = []byte("development-audit-key-" + os.Getenv("JWT_SECRET"))
	}
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write([]byte(payload))
	hash := hex.EncodeToString(mac.Sum(nil))
	_, err := DB.Exec(`INSERT INTO audit_events (user_id,username,action,resource,detail,prev_hash,event_hash,created_at)
		VALUES (?,?,?,?,?,?,?,?)`, nullableUserID(userID), username, action, resource, detail, previous, hash, now)
	return err
}

func nullableUserID(userID int64) interface{} {
	if userID == 0 {
		return nil
	}
	return userID
}

// VerifyAuditChain returns the first corrupted event ID, or zero when valid.
func VerifyAuditChain() (int64, error) {
	auditMu.Lock()
	defer auditMu.Unlock()
	rows, err := DB.Query(`SELECT id,COALESCE(user_id,0),username,action,resource,detail,prev_hash,event_hash,created_at FROM audit_events ORDER BY id`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()
	previous := ""
	key := []byte(os.Getenv("AUDIT_HMAC_KEY"))
	if len(key) == 0 {
		key = []byte("development-audit-key-" + os.Getenv("JWT_SECRET"))
	}
	for rows.Next() {
		var id, userID int64
		var username, action, resource, detail, prev, hash, created string
		if err := rows.Scan(&id, &userID, &username, &action, &resource, &detail, &prev, &hash, &created); err != nil {
			return 0, err
		}
		if prev != previous {
			return id, nil
		}
		payload := fmt.Sprintf("%s|%d|%s|%s|%s|%s|%s", prev, userID, username, action, resource, detail, created)
		mac := hmac.New(sha256.New, key)
		_, _ = mac.Write([]byte(payload))
		if !hmac.Equal([]byte(hash), []byte(hex.EncodeToString(mac.Sum(nil)))) {
			return id, nil
		}
		previous = hash
	}
	return 0, rows.Err()
}
