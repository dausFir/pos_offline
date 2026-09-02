package services

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestCleanupAutomaticBackupsOnlyDeletesExpiredPosbak(t *testing.T) {
	dir := t.TempDir()
	expired := filepath.Join(dir, "backup_otomatis_old.posbak")
	keep := filepath.Join(dir, "backup_otomatis_new.posbak")
	other := filepath.Join(dir, "manual.posbak")
	for _, p := range []string{expired, keep, other} {
		if err := os.WriteFile(p, []byte("x"), 0600); err != nil {
			t.Fatal(err)
		}
	}
	old := time.Now().AddDate(0, 0, -10)
	if err := os.Chtimes(expired, old, old); err != nil {
		t.Fatal(err)
	}
	if err := CleanupAutomaticBackups(dir, 7); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(expired); !os.IsNotExist(err) {
		t.Fatalf("expired backup should be deleted: %v", err)
	}
	if _, err := os.Stat(keep); err != nil {
		t.Fatalf("new backup should remain: %v", err)
	}
	if _, err := os.Stat(other); err != nil {
		t.Fatalf("manual backup should remain: %v", err)
	}
}
