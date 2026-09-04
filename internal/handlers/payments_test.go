package handlers

import "testing"

func TestValidPaymentMethod(t *testing.T) {
	for _, method := range []string{"cash", "qris", "transfer", "gopay", "ovo", "dana", "linkaja", "shopeepay"} {
		if !validPaymentMethod(method) { t.Fatalf("expected %s to be accepted", method) }
	}
	if validPaymentMethod("bitcoin") { t.Fatal("unexpected payment method accepted") }
}
