package services

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"

	"kasir-umkm/internal/database"
)

// TRACKING_SYNC_URL points to the Vercel application's /api/sync endpoint.
// The secret is never persisted in SQLite: set it in the process environment.
var trackingMu sync.Mutex

func TriggerTrackingSync() { go SyncTrackingOutbox() }

func SyncTrackingOutbox() {
	// Owner-configured URL wins, allowing a migration from Vercel to a private
	// server without rebuilding the POS. The signing secret intentionally stays
	// in the process environment and is never persisted in SQLite.
	url := database.GetSetting("tracking_sync_url", os.Getenv("TRACKING_SYNC_URL"))
	secret := os.Getenv("TRACKING_SYNC_SECRET")
	if url == "" || len(secret) < 24 { return }
	if !trackingMu.TryLock() { return }; defer trackingMu.Unlock()
	rows, err := database.DB.Query("SELECT id,payload FROM tracking_outbox WHERE status IN ('pending','failed') ORDER BY id LIMIT 20")
	if err != nil { return }; defer rows.Close()
	client:=&http.Client{Timeout:10*time.Second}
	for rows.Next() { var id int64; var payload string; if rows.Scan(&id,&payload)!=nil { continue }
		ts:=strconv.FormatInt(time.Now().UnixMilli(),10); mac:=hmac.New(sha256.New,[]byte(secret)); mac.Write([]byte(ts+"."+payload)); sig:=hex.EncodeToString(mac.Sum(nil))
		req,err:=http.NewRequest(http.MethodPost,url,bytes.NewBufferString(payload));if err!=nil{continue};req.Header.Set("Content-Type","application/json");req.Header.Set("x-pos-timestamp",ts);req.Header.Set("x-pos-signature",sig)
		res,err:=client.Do(req);if err==nil&&res!=nil&&res.StatusCode>=200&&res.StatusCode<300{res.Body.Close();database.DB.Exec("UPDATE tracking_outbox SET status='sent',attempts=attempts+1,last_error='',sent_at=? WHERE id=?",time.Now(),id)} else { if res!=nil {res.Body.Close()}; msg:="network or remote error";if err!=nil{msg=err.Error()};database.DB.Exec("UPDATE tracking_outbox SET status='failed',attempts=attempts+1,last_error=? WHERE id=?",msg,id) }
	}
}

func StartTrackingSyncScheduler() { go func(){ ticker:=time.NewTicker(5*time.Minute);defer ticker.Stop();for range ticker.C{SyncTrackingOutbox()} }() }
