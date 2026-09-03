//go:build !linux && !windows && !darwin

package services

import "os"

func platformMachineID() (string, error) { return os.Hostname() }
