package services

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"runtime"
)

// DeviceFingerprint returns a one-way identifier for license binding. Raw OS
// identifiers are never sent in activation requests or stored in the database.
func DeviceFingerprint() (string, error) {
	machineID, err := platformMachineID()
	if err != nil || machineID == "" {
		return "", fmt.Errorf("tidak dapat membaca identitas perangkat: %w", err)
	}
	sum := sha256.Sum256([]byte("kasir-umkm/device/v1|" + runtime.GOOS + "|" + machineID))
	return hex.EncodeToString(sum[:]), nil
}
