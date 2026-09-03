package middleware

import (
	"database/sql"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"kasir-umkm/internal/database"
)

func TestTrialMiddlewareBlocksActualImportRoute(t *testing.T) {
	setupTrialMiddlewareDB(t, time.Now().UTC())
	h := TrialMiddleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) }))
	r := httptest.NewRequest(http.MethodPost, "/api/import/products", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != http.StatusForbidden {
		t.Fatalf("import must be blocked for trial, got %d", w.Code)
	}
}

func TestTrialMiddlewareBlocksExpiredProtectedEndpoint(t *testing.T) {
	setupTrialMiddlewareDB(t, time.Now().UTC().Add(-8*24*time.Hour))
	h := TrialMiddleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) }))
	r := httptest.NewRequest(http.MethodPost, "/api/checkout", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expired trial must block checkout, got %d", w.Code)
	}
}

func setupTrialMiddlewareDB(t *testing.T, start time.Time) {
	t.Helper()
	oldDB := database.DB
	db, err := sql.Open("sqlite3", filepath.Join(t.TempDir(), "trial.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	database.DB = db
	t.Cleanup(func() { _ = db.Close(); database.DB = oldDB })
	if _, err = db.Exec(`CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at DATETIME)`); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(`CREATE TABLE products (id INTEGER PRIMARY KEY, is_deleted BOOLEAN NOT NULL DEFAULT 0)`); err != nil {
		t.Fatal(err)
	}
	if err = database.SetSetting("trial_started_at", start.Format(time.RFC3339)); err != nil {
		t.Fatal(err)
	}
	if err = database.SetSetting("trial_installation_id", "install-a"); err != nil {
		t.Fatal(err)
	}
}
