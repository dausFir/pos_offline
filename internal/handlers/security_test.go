package handlers

import "testing"

func TestValidPasswordPolicy(t *testing.T) {
	for _, password := range []string{"RapiPosAman2026", "KasirFlow9Secure"} {
		if !validPassword(password) { t.Fatalf("expected accepted password: %q", password) }
	}
	for _, password := range []string{"pendek1A", "semuahurufkecil2026", "SEMUAHURUFBESAR2026", "PasswordTanpaAngka"} {
		if validPassword(password) { t.Fatalf("expected rejected password: %q", password) }
	}
}
