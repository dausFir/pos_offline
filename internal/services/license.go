package services

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"kasir-umkm/internal/database"
)

const licenseTokenPrefix = "poslic-v1"

// LicensePublicKeyBase64 must be injected at release build time using -ldflags.
// The corresponding private key must never be included in the application.
var LicensePublicKeyBase64 string

var (
	ErrLicenseNotConfigured = errors.New("public key lisensi belum di-embed ke binary")
	ErrInvalidLicense       = errors.New("lisensi tidak valid")
	ErrLicenseDevice        = errors.New("lisensi bukan untuk perangkat ini")
)

type LicenseClaims struct {
	LicenseID      string `json:"license_id"`
	Product        string `json:"product"`
	InstallationID string `json:"installation_id"`
	DeviceHash     string `json:"device_hash"`
	IssuedAt       string `json:"issued_at"`
	ExpiresAt      string `json:"expires_at,omitempty"`
}

type LicenseStatus struct {
	Licensed          bool   `json:"licensed"`
	LicenseID         string `json:"license_id,omitempty"`
	InstallationID    string `json:"installation_id"`
	DeviceHash        string `json:"device_hash"`
	ActivationRequest string `json:"activation_request"`
}

type activationRequest struct {
	Product        string `json:"product"`
	InstallationID string `json:"installation_id"`
	DeviceHash     string `json:"device_hash"`
}

func InitializeLicense() error {
	if database.GetSetting("license_installation_id", "") != "" {
		return nil
	}
	b := make([]byte, 18)
	if _, err := rand.Read(b); err != nil {
		return err
	}
	return database.SetSetting("license_installation_id", base64.RawURLEncoding.EncodeToString(b))
}

func CurrentLicenseStatus(now time.Time) (LicenseStatus, error) {
	installationID := database.GetSetting("license_installation_id", "")
	deviceHash, err := DeviceFingerprint()
	if err != nil {
		return LicenseStatus{}, err
	}
	request, err := json.Marshal(activationRequest{Product: "kasir-umkm", InstallationID: installationID, DeviceHash: deviceHash})
	if err != nil {
		return LicenseStatus{}, err
	}
	status := LicenseStatus{InstallationID: installationID, DeviceHash: deviceHash, ActivationRequest: base64.RawURLEncoding.EncodeToString(request)}
	if claims, err := ValidLicense(now); err == nil {
		status.Licensed, status.LicenseID = true, claims.LicenseID
	}
	return status, nil
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
	if claims.InstallationID != database.GetSetting("license_installation_id", "") {
		return LicenseClaims{}, ErrLicenseDevice
	}
	deviceHash, err := DeviceFingerprint()
	if err != nil || claims.DeviceHash == "" || claims.DeviceHash != deviceHash {
		return LicenseClaims{}, ErrLicenseDevice
	}
	if claims.ExpiresAt != "" {
		expiresAt, parseErr := time.Parse(time.RFC3339, claims.ExpiresAt)
		if parseErr != nil || !now.Before(expiresAt) {
			return LicenseClaims{}, ErrInvalidLicense
		}
	}
	return claims, nil
}

func licensePublicKey() (ed25519.PublicKey, error) {
	if LicensePublicKeyBase64 == "" {
		return nil, ErrLicenseNotConfigured
	}
	key, err := base64.StdEncoding.DecodeString(LicensePublicKeyBase64)
	if err != nil || len(key) != ed25519.PublicKeySize {
		return nil, fmt.Errorf("%w", ErrLicenseNotConfigured)
	}
	return ed25519.PublicKey(key), nil
}
