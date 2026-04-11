package handlers

import (
	"net/http"
	"time"

	"kasir-umkm/internal/database"
	"kasir-umkm/internal/models"
)

// Kritis #2: Laporan Laba Rugi
func GetProfitReport(w http.ResponseWriter, r *http.Request) {
	dateFrom := r.URL.Query().Get("date_from")
	dateTo := r.URL.Query().Get("date_to")
	if dateFrom == "" {
		dateFrom = time.Now().Format("2006-01") + "-01"
	} // first day of month
	if dateTo == "" {
		dateTo = time.Now().Format("2006-01-02")
	}

	// Validate date range
	if dateTo < dateFrom {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Tanggal akhir tidak boleh lebih kecil dari tanggal awal"})
		return
	}

	dateToEnd := dateTo + " 23:59:59"
	_ = dateToEnd

	q := `SELECT
		COALESCE(SUM(td.subtotal), 0)                      as revenue,
		COALESCE(SUM(td.buy_price * td.quantity), 0)        as cogs,
		COALESCE(SUM(td.subtotal - td.buy_price*td.quantity), 0) as profit,
		COALESCE(SUM(td.quantity), 0)                       as items_sold,
		COUNT(DISTINCT t.id)                                as tx_count
	FROM transactions t
	JOIN transaction_details td ON td.transaction_id = t.id
	WHERE t.status='completed' AND t.is_deleted=0
	AND t.created_at >= ? AND t.created_at <= ?`

	var rev, cogs, profit float64
	var itemsSold, txCount int
	database.DB.QueryRow(q, dateFrom, dateToEnd).Scan(&rev, &cogs, &profit, &itemsSold, &txCount)

	marginPct := 0.0
	if rev > 0 {
		marginPct = profit / rev * 100
	}
	avgTicket := 0.0
	if txCount > 0 {
		avgTicket = rev / float64(txCount)
	}

	// Per category breakdown
	catQ := `SELECT
		COALESCE(td.category_name, 'Tanpa Kategori') as cat,
		SUM(td.subtotal)                               as revenue,
		SUM(td.buy_price * td.quantity)               as cogs,
		SUM(td.subtotal - td.buy_price * td.quantity) as profit,
		SUM(td.quantity)                               as items_sold
	FROM transactions t
	JOIN transaction_details td ON td.transaction_id = t.id
	WHERE t.status='completed' AND t.is_deleted=0
	AND t.created_at >= ? AND t.created_at <= ?
	GROUP BY td.category_name ORDER BY revenue DESC`

	catRows, _ := database.DB.Query(catQ, dateFrom, dateToEnd)
	defer catRows.Close()
	var byCategory []models.ProfitByCategory
	for catRows.Next() {
		var c models.ProfitByCategory
		catRows.Scan(&c.CategoryName, &c.Revenue, &c.COGS, &c.Profit, &c.ItemsSold)
		if c.Revenue > 0 {
			c.MarginPct = c.Profit / c.Revenue * 100
		}
		byCategory = append(byCategory, c)
	}
	if byCategory == nil {
		byCategory = []models.ProfitByCategory{}
	}

	// Daily trend for the period
	dailyQ := `SELECT DATE(t.created_at) as day,
		COALESCE(SUM(td.subtotal),0) as rev,
		COALESCE(SUM(td.buy_price*td.quantity),0) as cogs
	FROM transactions t
	JOIN transaction_details td ON td.transaction_id=t.id
	WHERE t.status='completed' AND t.is_deleted=0
	AND t.created_at >= ? AND t.created_at <= ?
	GROUP BY day ORDER BY day`

	type DailyRow struct {
		Day    string  `json:"day"`
		Rev    float64 `json:"rev"`
		COGS   float64 `json:"cogs"`
		Profit float64 `json:"profit"`
	}
	dRows, _ := database.DB.Query(dailyQ, dateFrom, dateToEnd)
	defer dRows.Close()
	var daily []DailyRow
	for dRows.Next() {
		var d DailyRow
		dRows.Scan(&d.Day, &d.Rev, &d.COGS)
		d.Profit = d.Rev - d.COGS
		daily = append(daily, d)
	}
	if daily == nil {
		daily = []DailyRow{}
	}

	writeJSON(w, http.StatusOK, models.APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"summary": models.ProfitReport{
				Period:       dateFrom + " s/d " + dateTo,
				TotalRevenue: rev, TotalCOGS: cogs,
				GrossProfit: profit, MarginPct: marginPct,
				TxCount: txCount, ItemsSold: itemsSold, AvgTicket: avgTicket,
			},
			"by_category": byCategory,
			"daily":       daily,
			"date_from":   dateFrom,
			"date_to":     dateTo,
		},
	})
}

// Kritis #5: Status server & IP
func GetServerStatus(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, models.APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"status":    "online",
			"version":   database.AppVersion,
			"timestamp": time.Now(),
		},
	})
}
