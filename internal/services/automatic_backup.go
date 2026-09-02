package services

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"kasir-umkm/internal/database"
)

// CreateAutomaticBackup creates an encrypted local copy without placing the
// owner password in SQLite. The password must come from AUTO_BACKUP_PASSWORD.
func CreateAutomaticBackup(dbPath, dir, password string, retentionDays int) (string, error) {
	if len(password) < 12 {
		return "", ErrInvalidBackupPassword
	}
	if _, err := database.DB.Exec("PRAGMA wal_checkpoint(FULL)"); err != nil {
		return "", fmt.Errorf("checkpoint: %w", err)
	}
	data, err := os.ReadFile(dbPath)
	if err != nil {
		return "", err
	}
	encrypted, err := EncryptBackup(data, password)
	if err != nil {
		return "", err
	}
	if err = os.MkdirAll(dir, 0700); err != nil {
		return "", err
	}
	path := filepath.Join(dir, "backup_otomatis_"+time.Now().Format("20060102_150405")+".posbak")
	if err = os.WriteFile(path, encrypted, 0600); err != nil {
		return "", err
	}
	if retentionDays > 0 {
		_ = CleanupAutomaticBackups(dir, retentionDays)
	}
	_ = database.SetSetting("last_auto_backup_at", time.Now().UTC().Format(time.RFC3339))
	return path, nil
}

func CleanupAutomaticBackups(dir string, retentionDays int) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	cutoff := time.Now().AddDate(0, 0, -retentionDays)
	for _, e := range entries {
		if e.IsDir() || !strings.HasPrefix(e.Name(), "backup_otomatis_") || !strings.HasSuffix(e.Name(), ".posbak") {
			continue
		}
		info, err := e.Info()
		if err == nil && info.ModTime().Before(cutoff) {
			_ = os.Remove(filepath.Join(dir, e.Name()))
		}
	}
	return nil
}

// StartBackupScheduler is deliberately opt-in. In offline deployments owners
// set AUTO_BACKUP_PASSWORD and the application retains 14 daily backups by default.
func StartBackupScheduler(dbPath string) {
	password := os.Getenv("AUTO_BACKUP_PASSWORD")
	if password == "" {
		log.Println("ℹ️ Backup otomatis nonaktif: AUTO_BACKUP_PASSWORD belum di-set")
		return
	}
	days := 14
	if raw := os.Getenv("BACKUP_RETENTION_DAYS"); raw != "" {
		if n, e := strconv.Atoi(raw); e == nil && n > 0 {
			days = n
		}
	}
	dir := os.Getenv("BACKUP_DIRECTORY")
	if dir == "" {
		dir = "backups"
	}
	go func() {
		for {
			now := time.Now()
			next := time.Date(now.Year(), now.Month(), now.Day()+1, 2, 0, 0, 0, now.Location())
			time.Sleep(time.Until(next))
			if path, err := CreateAutomaticBackup(dbPath, dir, password, days); err != nil {
				log.Printf("❌ Backup otomatis gagal: %v", err)
			} else {
				log.Printf("✅ Backup otomatis dibuat: %s", path)
			}
		}
	}()
}
