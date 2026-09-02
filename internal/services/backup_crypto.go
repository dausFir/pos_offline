package services

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"errors"
	"fmt"

	"golang.org/x/crypto/argon2"
)

const (
	backupMagic       = "POSBAK01"
	backupVersion     = byte(1)
	backupSaltSize    = 16
	backupKeySize     = 32
	minBackupPassword = 12
	argonTime         = uint32(3)
	argonMemory       = uint32(64 * 1024)
	argonThreads      = uint8(2)
)

var (
	ErrInvalidBackupPassword = errors.New("password backup minimal 12 karakter")
	ErrInvalidBackupFile     = errors.New("file backup terenkripsi tidak valid atau password salah")
)

// EncryptBackup converts database bytes into the versioned POSBAK container.
// AES-GCM authenticates both the ciphertext and its header, so altered backups
// cannot be restored successfully.
func EncryptBackup(databaseData []byte, password string) ([]byte, error) {
	if len(password) < minBackupPassword {
		return nil, ErrInvalidBackupPassword
	}

	salt := make([]byte, backupSaltSize)
	if _, err := rand.Read(salt); err != nil {
		return nil, fmt.Errorf("buat salt backup: %w", err)
	}
	key := deriveBackupKey(password, salt)
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("buat cipher backup: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("buat cipher backup: %w", err)
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, fmt.Errorf("buat nonce backup: %w", err)
	}

	header := append([]byte(backupMagic), backupVersion)
	ciphertext := gcm.Seal(nil, nonce, databaseData, header)
	result := make([]byte, 0, len(header)+len(salt)+len(nonce)+len(ciphertext))
	result = append(result, header...)
	result = append(result, salt...)
	result = append(result, nonce...)
	result = append(result, ciphertext...)
	return result, nil
}

// DecryptBackup verifies and decrypts a POSBAK container.
func DecryptBackup(encryptedData []byte, password string) ([]byte, error) {
	if len(password) < minBackupPassword {
		return nil, ErrInvalidBackupPassword
	}
	headerLength := len(backupMagic) + 1
	if len(encryptedData) < headerLength+backupSaltSize+12+16 || string(encryptedData[:len(backupMagic)]) != backupMagic || encryptedData[len(backupMagic)] != backupVersion {
		return nil, ErrInvalidBackupFile
	}

	header := encryptedData[:headerLength]
	salt := encryptedData[headerLength : headerLength+backupSaltSize]
	key := deriveBackupKey(password, salt)
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, ErrInvalidBackupFile
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, ErrInvalidBackupFile
	}
	nonceStart := headerLength + backupSaltSize
	nonceEnd := nonceStart + gcm.NonceSize()
	if len(encryptedData) < nonceEnd+gcm.Overhead() {
		return nil, ErrInvalidBackupFile
	}
	plaintext, err := gcm.Open(nil, encryptedData[nonceStart:nonceEnd], encryptedData[nonceEnd:], header)
	if err != nil {
		return nil, ErrInvalidBackupFile
	}
	return plaintext, nil
}

func deriveBackupKey(password string, salt []byte) []byte {
	return argon2.IDKey([]byte(password), salt, argonTime, argonMemory, argonThreads, backupKeySize)
}
