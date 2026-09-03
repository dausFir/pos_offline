//go:build windows

package services

import (
	"fmt"

	"golang.org/x/sys/windows/registry"
)

func platformMachineID() (string, error) {
	key, err := registry.OpenKey(registry.LOCAL_MACHINE, `SOFTWARE\Microsoft\Cryptography`, registry.QUERY_VALUE)
	if err != nil {
		return "", err
	}
	defer key.Close()
	id, _, err := key.GetStringValue("MachineGuid")
	if err != nil || id == "" {
		return "", fmt.Errorf("MachineGuid Windows tidak tersedia: %w", err)
	}
	return id, nil
}
