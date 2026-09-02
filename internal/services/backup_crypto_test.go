package services

import (
	"bytes"
	"errors"
	"testing"
)

const testBackupPassword = "owner-backup-password"

func TestBackupEncryptionRoundTrip(t *testing.T) {
	original := []byte("SQLite format 3\x00database-content")
	encrypted, err := EncryptBackup(original, testBackupPassword)
	if err != nil {
		t.Fatalf("EncryptBackup() error = %v", err)
	}
	if bytes.Contains(encrypted, original) {
		t.Fatal("encrypted backup contains plaintext database data")
	}

	decrypted, err := DecryptBackup(encrypted, testBackupPassword)
	if err != nil {
		t.Fatalf("DecryptBackup() error = %v", err)
	}
	if !bytes.Equal(decrypted, original) {
		t.Fatalf("decrypted data = %q, want %q", decrypted, original)
	}
}

func TestBackupEncryptionRejectsWrongPassword(t *testing.T) {
	encrypted, err := EncryptBackup([]byte("database"), testBackupPassword)
	if err != nil {
		t.Fatalf("EncryptBackup() error = %v", err)
	}
	if _, err := DecryptBackup(encrypted, "another-owner-password"); !errors.Is(err, ErrInvalidBackupFile) {
		t.Fatalf("DecryptBackup() error = %v, want ErrInvalidBackupFile", err)
	}
}

func TestBackupEncryptionRejectsModifiedFile(t *testing.T) {
	encrypted, err := EncryptBackup([]byte("database"), testBackupPassword)
	if err != nil {
		t.Fatalf("EncryptBackup() error = %v", err)
	}
	encrypted[len(encrypted)-1] ^= 0x01
	if _, err := DecryptBackup(encrypted, testBackupPassword); !errors.Is(err, ErrInvalidBackupFile) {
		t.Fatalf("DecryptBackup() error = %v, want ErrInvalidBackupFile", err)
	}
}

func TestBackupEncryptionRequiresStrongPassword(t *testing.T) {
	if _, err := EncryptBackup([]byte("database"), "short"); !errors.Is(err, ErrInvalidBackupPassword) {
		t.Fatalf("EncryptBackup() error = %v, want ErrInvalidBackupPassword", err)
	}
}
