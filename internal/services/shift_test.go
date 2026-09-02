package services

import "testing"

func TestReconcileCash(t *testing.T) {
	expected, diff := ReconcileCash(100000, 250000, 340000)
	if expected != 350000 || diff != -10000 {
		t.Fatalf("got expected=%v diff=%v", expected, diff)
	}
}
