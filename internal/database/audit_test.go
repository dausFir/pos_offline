package database

import (
	"database/sql"
	"path/filepath"
	"testing"
)

func TestAuditChainDetectsManipulation(t *testing.T) {
	oldDB := DB
	t.Cleanup(func() {
		if DB != nil {
			_ = DB.Close()
		}
		DB = oldDB
	})
	path := filepath.Join(t.TempDir(), "audit.sqlite")
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		t.Fatal(err)
	}
	DB = db
	_, err = DB.Exec(`CREATE TABLE audit_events (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,username TEXT,action TEXT,resource TEXT,detail TEXT,prev_hash TEXT,event_hash TEXT,created_at TEXT)`)
	if err != nil {
		t.Fatal(err)
	}
	t.Setenv("AUDIT_HMAC_KEY", "audit-test-secret-that-is-at-least-32-chars")
	t.Setenv("JWT_SECRET", "jwt-test-secret")
	if err := RecordAuditEvent(0, "", "POST", "/api/backup", "status=200"); err != nil {
		t.Fatal(err)
	}
	if bad, err := VerifyAuditChain(); err != nil || bad != 0 {
		t.Fatalf("valid chain: bad=%d err=%v", bad, err)
	}
	if _, err := DB.Exec("UPDATE audit_events SET detail='status=500' WHERE id=1"); err != nil {
		t.Fatal(err)
	}
	if bad, err := VerifyAuditChain(); err != nil || bad != 1 {
		t.Fatalf("tampered chain: bad=%d err=%v", bad, err)
	}
}
