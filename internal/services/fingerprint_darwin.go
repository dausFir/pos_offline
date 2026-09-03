//go:build darwin

package services

import (
	"fmt"
	"os/exec"
	"regexp"
)

var macUUIDPattern = regexp.MustCompile(`"IOPlatformUUID"\s*=\s*"([^"]+)"`)

func platformMachineID() (string, error) {
	raw, err := exec.Command("ioreg", "-rd1", "-c", "IOPlatformExpertDevice").Output()
	if err != nil {
		return "", err
	}
	match := macUUIDPattern.FindStringSubmatch(string(raw))
	if len(match) != 2 {
		return "", fmt.Errorf("IOPlatformUUID macOS tidak ditemukan")
	}
	return match[1], nil
}
