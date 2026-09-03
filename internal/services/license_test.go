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

func TestVerifyLicenseAcceptsSignedDeviceBoundToken(t *testing.T) {
	privateKey, status := setupLicenseTestDB(t)
	now := time.Date(2026, 9, 3, 0, 0, 0, 0, time.UTC)
	token := signedTestLicense(t, privateKey, LicenseClaims{LicenseID: "lic-1", Product: "kasir-umkm", InstallationID: status.InstallationID, DeviceHash: status.DeviceHash, IssuedAt: now.Format(time.RFC3339)})
	claims, err := VerifyLicense(token, now)
	if err != nil || claims.LicenseID != "lic-1" {
		t.Fatalf("license should validate, claims=%+v err=%v", claims, err)
	}
}

func TestVerifyLicenseRejectsOtherDevice(t *testing.T) {
	privateKey, status := setupLicenseTestDB(t)
	token := signedTestLicense(t, privateKey, LicenseClaims{LicenseID: "lic-1", Product: "kasir-umkm", InstallationID: status.InstallationID, DeviceHash: "copied-to-another-device"})
	if _, err := VerifyLicense(token, time.Now().UTC()); err != ErrLicenseDevice {
		t.Fatalf("expected device error, got %v", err)
	}
}

func TestActivationRequestDoesNotExposeRawMachineIdentifier(t *testing.T) {
	_, status := setupLicenseTestDB(t)
	decoded, err := base64.RawURLEncoding.DecodeString(status.ActivationRequest)
	if err != nil {
		t.Fatal(err)
	}
	var request activationRequest
	if err = json.Unmarshal(decoded, &request); err != nil {
		t.Fatal(err)
	}
	if request.DeviceHash != status.DeviceHash || len(request.DeviceHash) != 64 {
		t.Fatalf("expected SHA-256 device hash, got %q", request.DeviceHash)
	}
}

func setupLicenseTestDB(t *testing.T) (ed25519.PrivateKey, LicenseStatus) {
	t.Helper()
	oldDB, oldKey := database.DB, LicensePublicKeyBase64
	db, err := sql.Open("sqlite3", filepath.Join(t.TempDir(), "license.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	database.DB = db
	t.Cleanup(func() { _ = db.Close(); database.DB, LicensePublicKeyBase64 = oldDB, oldKey })
	if _, err = db.Exec(`CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at DATETIME)`); err != nil {
		t.Fatal(err)
	}
	if err = InitializeLicense(); err != nil {
		t.Fatal(err)
	}
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	LicensePublicKeyBase64 = base64.StdEncoding.EncodeToString(publicKey)
	status, err := CurrentLicenseStatus(time.Now().UTC())
	if err != nil {
		t.Fatal(err)
	}
	return privateKey, status
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
