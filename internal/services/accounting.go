package services

// AllocateDiscount allocates a transaction-level discount to each line. The
// final line receives the rounding residual so the allocation is exact.
func AllocateDiscount(subtotals []float64, discount float64) []float64 {
	allocated := make([]float64, len(subtotals))
	var total, used float64
	for _, subtotal := range subtotals { total += subtotal }
	if total <= 0 || discount <= 0 { return allocated }
	if discount > total { discount = total }
	for i, subtotal := range subtotals {
		if i == len(subtotals)-1 { allocated[i] = discount - used; break }
		allocated[i] = discount * subtotal / total
		used += allocated[i]
	}
	return allocated
}

func OutstandingBalance(invoiceTotal, customerAdvance float64) float64 {
	if customerAdvance >= invoiceTotal { return 0 }
	return invoiceTotal - customerAdvance
}
