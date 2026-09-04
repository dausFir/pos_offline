package services

import "testing"

func TestAllocateDiscountKeepsExactTotal(t *testing.T) {
	got := AllocateDiscount([]float64{10000, 20000, 70000}, 13500)
	if got[0]+got[1]+got[2] != 13500 { t.Fatalf("allocation = %v", got) }
	if got[0] != 1350 || got[1] != 2700 || got[2] != 9450 { t.Fatalf("unexpected allocation: %v", got) }
}

func TestOutstandingBalanceNeverNegative(t *testing.T) {
	if got := OutstandingBalance(100000, 25000); got != 75000 { t.Fatalf("got %v", got) }
	if got := OutstandingBalance(100000, 150000); got != 0 { t.Fatalf("got %v", got) }
}
