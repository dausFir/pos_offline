//go:build linux

package services

import (
	"fmt"
	"os"
	"strings"
)

func platformMachineID() (string, error) {
	for _, path := range []string{"/etc/machine-id", "/var/lib/dbus/machine-id", "/sys/class/dmi/id/product_uuid"} {
		if raw, err := os.ReadFile(path); err == nil && strings.TrimSpace(string(raw)) != "" {
			return strings.TrimSpace(string(raw)), nil
		}
	}
	return "", fmt.Errorf("machine-id Linux tidak ditemukan")
}
