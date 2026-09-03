package services

import (
	"crypto/ed25519"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"path/filepath"
	"testing"
	"time"

	"kasir-umkm/internal/database"
)

func TestVerifyLicenseAcceptsSignedInstallationBoundToken(t *testing.T) {
	privateKey := setupLicenseTestDB(t, "install-a")
	now := time.Date(2026, 9, 3, 0, 0, 0, 0, time.UTC)
	token := signedTestLicense(t, privateKey, LicenseClaims{
		LicenseID: "lic-1", Product: "kasir-umkm", InstallationID: "install-a", IssuedAt: now.Format(time.RFC3339),
	})
	claims, err := VerifyLicense(token, now)
	if err != nil || claims.LicenseID != "lic-1" {
		t.Fatalf("license should validate, claims=%+v err=%v", claims, err)
	}
}

func TestVerifyLicenseRejectsOtherInstallation(t *testing.T) {
	privateKey := setupLicenseTestDB(t, "install-a")
	token := signedTestLicense(t, privateKey, LicenseClaims{LicenseID: "lic-1", Product: "kasir-umkm", InstallationID: "install-b"})
	if _, err := VerifyLicense(token, time.Now().UTC()); err != ErrLicenseInstallation {
		t.Fatalf("expected installation error, got %v", err)
	}
}

func TestTrialStatusExpiresAfterSevenDays(t *testing.T) {
	setupLicenseTestDB(t, "install-a")
	start := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
	if err := database.SetSetting("trial_started_at", start.Format(time.RFC3339)); err != nil {
		t.Fatal(err)
	}
	if status := CurrentTrialStatus(start.Add(6 * 24 * time.Hour)); status.Expired || status.DaysRemaining != 1 {
		t.Fatalf("expected one active day, got %+v", status)
	}
	if status := CurrentTrialStatus(start.Add(7 * 24 * time.Hour)); !status.Expired {
		t.Fatalf("expected expired trial, got %+v", status)
	}
}

func setupLicenseTestDB(t *testing.T, installationID string) ed25519.PrivateKey {
	t.Helper()
	oldDB := database.DB
	db, err := sql.Open("sqlite3", filepath.Join(t.TempDir(), "trial.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	database.DB = db
	t.Cleanup(func() {
		_ = db.Close()
		database.DB = oldDB
	})
	if _, err = db.Exec(`CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at DATETIME)`); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(`CREATE TABLE products (id INTEGER PRIMARY KEY, is_deleted BOOLEAN NOT NULL DEFAULT 0)`); err != nil {
		t.Fatal(err)
	}
	if err = database.SetSetting("trial_installation_id", installationID); err != nil {
		t.Fatal(err)
	}
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	t.Setenv("LICENSE_PUBLIC_KEY", base64.StdEncoding.EncodeToString(publicKey))
	return privateKey
}

func signedTestLicense(t *testing.T, privateKey ed25519.PrivateKey, claims LicenseClaims) string {
	t.Helper()
	payload, err := json.Marshal(claims)
	if err != nil {
		t.Fatal(err)
	}
	signature := ed25519.Sign(privateKey, payload)
	return licenseTokenPrefix + "." + base64.RawURLEncoding.EncodeToString(payload) + "." + base64.RawURLEncoding.EncodeToString(signature)
}
