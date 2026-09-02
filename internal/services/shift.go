package services

func ReconcileCash(openingCash, cashSales, countedCash float64) (expected, difference float64) {
	expected = openingCash + cashSales
	difference = countedCash - expected
	return expected, difference
}
