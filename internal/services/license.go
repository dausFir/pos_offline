package services

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"kasir-umkm/internal/database"
)

const (
	trialDuration      = 7 * 24 * time.Hour
	licenseTokenPrefix = "poslic-v1"
)

var (
	ErrLicenseNotConfigured = errors.New("LICENSE_PUBLIC_KEY belum dikonfigurasi")
	ErrInvalidLicense       = errors.New("license tidak valid")
	ErrLicenseInstallation  = errors.New("license bukan untuk instalasi ini")
)

// LicenseClaims is the signed, portable license payload. The private signing
// key must stay with the seller; this application only ever needs the public key.
type LicenseClaims struct {
	LicenseID      string `json:"license_id"`
	Product        string `json:"product"`
	InstallationID string `json:"installation_id"`
	IssuedAt       string `json:"issued_at"`
	ExpiresAt      string `json:"expires_at,omitempty"`
}

// TrialStatus is deliberately limited to non-sensitive information suitable for UI.
type TrialStatus struct {
	Edition       string `json:"edition"`
	Expired       bool   `json:"expired"`
	DaysRemaining int    `json:"days_remaining"`
	ProductLimit  int    `json:"product_limit"`
	Licensed      bool   `json:"licensed"`
}

func InitializeTrial() error {
	if database.GetSetting("trial_installation_id", "") == "" {
		id, err := randomInstallationID()
		if err != nil {
			return err
		}
		if err := database.SetSetting("trial_installation_id", id); err != nil {
			return err
		}
	}
	if database.GetSetting("trial_started_at", "") == "" {
		return database.SetSetting("trial_started_at", time.Now().UTC().Format(time.RFC3339))
	}
	return nil
}

func CurrentTrialStatus(now time.Time) TrialStatus {
	status := TrialStatus{Edition: "trial", ProductLimit: 20}
	if _, err := ValidLicense(now); err == nil {
		status.Edition, status.Licensed = "full", true
		return status
	}
	startedAt, err := time.Parse(time.RFC3339, database.GetSetting("trial_started_at", ""))
	if err != nil {
		status.Expired = true
		return status
	}
	// Use the injected time for deterministic callers and tests.
	remaining := startedAt.Add(trialDuration).Sub(now)
	if remaining <= 0 {
		status.Expired = true
		return status
	}
	status.DaysRemaining = int((remaining + 24*time.Hour - time.Nanosecond) / (24 * time.Hour))
	return status
}

func IsTrialLimited(now time.Time) bool {
	return !CurrentTrialStatus(now).Licensed
}

func ActivateLicense(token string, now time.Time) (LicenseClaims, error) {
	claims, err := VerifyLicense(token, now)
	if err != nil {
		return LicenseClaims{}, err
	}
	if err := database.SetSetting("license_token", token); err != nil {
		return LicenseClaims{}, err
	}
	return claims, nil
}

func ValidLicense(now time.Time) (LicenseClaims, error) {
	token := database.GetSetting("license_token", "")
	if token == "" {
		return LicenseClaims{}, ErrInvalidLicense
	}
	return VerifyLicense(token, now)
}

// VerifyLicense validates a seller-signed Ed25519 license and its installation binding.
func VerifyLicense(token string, now time.Time) (LicenseClaims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 || parts[0] != licenseTokenPrefix {
		return LicenseClaims{}, ErrInvalidLicense
	}
	publicKey, err := licensePublicKey()
	if err != nil {
		return LicenseClaims{}, err
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return LicenseClaims{}, ErrInvalidLicense
	}
	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil || !ed25519.Verify(publicKey, payload, signature) {
		return LicenseClaims{}, ErrInvalidLicense
	}
	var claims LicenseClaims
	if err = json.Unmarshal(payload, &claims); err != nil || claims.LicenseID == "" || claims.Product != "kasir-umkm" {
		return LicenseClaims{}, ErrInvalidLicense
	}
	if claims.InstallationID != database.GetSetting("trial_installation_id", "") {
		return LicenseClaims{}, ErrLicenseInstallation
	}
	if claims.ExpiresAt != "" {
		expiresAt, parseErr := time.Parse(time.RFC3339, claims.ExpiresAt)
		if parseErr != nil || !now.Before(expiresAt) {
			return LicenseClaims{}, ErrInvalidLicense
		}
	}
	return claims, nil
}

func ProductLimitReached() (bool, error) {
	var count int
	if err := database.DB.QueryRow("SELECT COUNT(*) FROM products WHERE is_deleted=0").Scan(&count); err != nil {
		return false, err
	}
	return count >= 20, nil
}

func randomInstallationID() (string, error) {
	b := make([]byte, 18)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func licensePublicKey() (ed25519.PublicKey, error) {
	raw := os.Getenv("LICENSE_PUBLIC_KEY")
	if raw == "" {
		return nil, ErrLicenseNotConfigured
	}
	key, err := base64.StdEncoding.DecodeString(raw)
	if err != nil || len(key) != ed25519.PublicKeySize {
		return nil, fmt.Errorf("%w: harus base64 Ed25519 public key", ErrLicenseNotConfigured)
	}
	return ed25519.PublicKey(key), nil
}
