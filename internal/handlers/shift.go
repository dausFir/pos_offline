package handlers

import (
	"net/http"
	"time"

	"kasir-umkm/internal/database"
	"kasir-umkm/internal/models"
)

func GetShiftReport(w http.ResponseWriter, r *http.Request) {
	dateFrom := r.URL.Query().Get("date_from")
	dateTo := r.URL.Query().Get("date_to")
	if dateFrom == "" {
		dateFrom = time.Now().Format("2006-01-02")
	}
	if dateTo == "" {
		dateTo = time.Now().Format("2006-01-02")
	}

	// Validate date range
	if dateTo < dateFrom {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Tanggal akhir tidak boleh lebih kecil dari tanggal awal"})
		return
	}

	// dateTo end of day for range comparison
	dateToEnd := dateTo + " 23:59:59"

	rows, err := database.DB.Query(
		`SELECT u.id, u.username,
		 COUNT(CASE WHEN t.status='completed' THEN 1 END)  as tx_count,
		 COALESCE(SUM(CASE WHEN t.status='completed' THEN t.total_amount END), 0) as revenue,
		 COALESCE(SUM(CASE WHEN t.status='completed' THEN td_p.profit END), 0) as profit,
		 COUNT(CASE WHEN t.status='cancelled' THEN 1 END)  as cancelled_count
		 FROM users u
		 LEFT JOIN transactions t
		   ON t.user_id=u.id
		   AND t.is_deleted=0
		   AND t.created_at >= ?
		   AND t.created_at <= ?
		 LEFT JOIN (
		   SELECT transaction_id, SUM(subtotal - buy_price*quantity) as profit
		   FROM transaction_details GROUP BY transaction_id
		 ) td_p ON td_p.transaction_id = t.id
		 WHERE u.is_deleted=0
		   AND u.role IN ('cashier','admin','super_admin')
		 GROUP BY u.id
		 HAVING tx_count > 0 OR cancelled_count > 0
		 ORDER BY revenue DESC`,
		dateFrom, dateToEnd,
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	defer rows.Close()

	var reports []models.ShiftReport
	for rows.Next() {
		var s models.ShiftReport
		rows.Scan(&s.UserID, &s.Username, &s.TxCount, &s.TotalRevenue, &s.TotalProfit, &s.CancelledCount)
		if s.TxCount > 0 {
			s.AvgTicket = s.TotalRevenue / float64(s.TxCount)
		}
		s.Date = dateFrom
		reports = append(reports, s)
	}
	if reports == nil {
		reports = []models.ShiftReport{}
	}

	var totalRev, totalProfit float64
	var totalTx, totalCancel int
	for _, r := range reports {
		totalRev += r.TotalRevenue
		totalProfit += r.TotalProfit
		totalTx += r.TxCount
		totalCancel += r.CancelledCount
	}

	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: map[string]interface{}{
		"reports":       reports,
		"date_from":     dateFrom,
		"date_to":       dateTo,
		"total_revenue": totalRev,
		"total_profit":  totalProfit,
		"total_tx":      totalTx,
		"total_cancel":  totalCancel,
	}})
}
