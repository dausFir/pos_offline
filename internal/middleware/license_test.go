package middleware

import (
	"database/sql"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"kasir-umkm/internal/database"
)

func TestFullLicenseMiddlewareBlocksBusinessRouteWithoutLicense(t *testing.T) {
	oldDB := database.DB
	db, err := sql.Open("sqlite3", filepath.Join(t.TempDir(), "license.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	database.DB = db
	t.Cleanup(func() { _ = db.Close(); database.DB = oldDB })
	if _, err = db.Exec(`CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at DATETIME)`); err != nil {
		t.Fatal(err)
	}
	h := FullLicenseMiddleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) }))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/checkout", nil))
	if w.Code != http.StatusForbidden {
		t.Fatalf("business route must be blocked without license, got %d", w.Code)
	}
}
