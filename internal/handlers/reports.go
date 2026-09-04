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
		COALESCE(SUM(td.net_subtotal), 0)                  as revenue,
		COALESCE(SUM(td.subtotal), 0)                      as gross_revenue,
		COALESCE(SUM(td.discount_amount), 0)               as discount_total,
		COALESCE(SUM(td.buy_price * td.quantity), 0)        as cogs,
		COALESCE(SUM(td.net_subtotal - td.buy_price*td.quantity), 0) as profit,
		COALESCE(SUM(td.quantity), 0)                       as items_sold,
		COUNT(DISTINCT t.id)                                as tx_count
	FROM transactions t
	JOIN transaction_details td ON td.transaction_id = t.id
	WHERE t.status='completed' AND t.is_deleted=0
	AND t.created_at >= ? AND t.created_at <= ?`

	var rev, grossRev, discountTotal, cogs, profit, ppn float64
	var itemsSold, txCount int
	database.DB.QueryRow(q, dateFrom, dateToEnd).Scan(&rev, &grossRev, &discountTotal, &cogs, &profit, &itemsSold, &txCount)
	_ = database.DB.QueryRow(`SELECT COALESCE(SUM(ppn_amount),0) FROM transactions WHERE status='completed' AND is_deleted=0 AND created_at>=? AND created_at<=?`, dateFrom,dateToEnd).Scan(&ppn)
	var serviceCosts float64
	_ = database.DB.QueryRow(`SELECT COALESCE(SUM(sc.amount),0) FROM service_costs sc JOIN service_orders so ON so.id=sc.service_order_id JOIN transactions t ON t.id=so.invoice_id WHERE t.status='completed' AND t.is_deleted=0 AND t.created_at>=? AND t.created_at<=?`, dateFrom,dateToEnd).Scan(&serviceCosts)
	profit -= serviceCosts

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
		SUM(td.net_subtotal)                           as revenue,
		SUM(td.buy_price * td.quantity)               as cogs,
		SUM(td.net_subtotal - td.buy_price * td.quantity) as profit,
		SUM(td.quantity)                               as items_sold
	FROM transactions t
	JOIN transaction_details td ON td.transaction_id = t.id
	WHERE t.status='completed' AND t.is_deleted=0
	AND t.created_at >= ? AND t.created_at <= ?
	GROUP BY td.category_name ORDER BY revenue DESC`

	catRows, _ := database.DB.Query(catQ, dateFrom, dateToEnd)
	if catRows != nil { defer catRows.Close() }
	var byCategory []models.ProfitByCategory
	if catRows != nil { for catRows.Next() {
		var c models.ProfitByCategory
		catRows.Scan(&c.CategoryName, &c.Revenue, &c.COGS, &c.Profit, &c.ItemsSold)
		if c.Revenue > 0 {
			c.MarginPct = c.Profit / c.Revenue * 100
		}
		byCategory = append(byCategory, c)
	} }
	if byCategory == nil {
		byCategory = []models.ProfitByCategory{}
	}

	// Daily trend for the period
	dailyQ := `SELECT DATE(t.created_at) as day,
		COALESCE(SUM(td.net_subtotal),0) as rev,
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
	if dRows != nil { defer dRows.Close() }
	var daily []DailyRow
	if dRows != nil { for dRows.Next() {
		var d DailyRow
		dRows.Scan(&d.Day, &d.Rev, &d.COGS)
		d.Profit = d.Rev - d.COGS
		daily = append(daily, d)
	} }
	if daily == nil {
		daily = []DailyRow{}
	}

	writeJSON(w, http.StatusOK, models.APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"summary": models.ProfitReport{
				Period:       dateFrom + " s/d " + dateTo,
				TotalRevenue: rev, GrossRevenue:grossRev, DiscountTotal:discountTotal, PPNOutput:ppn, ServiceCosts:serviceCosts, TotalCOGS: cogs,
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
