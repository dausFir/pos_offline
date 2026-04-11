package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"kasir-umkm/internal/database"
	"kasir-umkm/internal/middleware"
	"kasir-umkm/internal/models"
)

func GetCustomers(w http.ResponseWriter, r *http.Request) {
	search   := r.URL.Query().Get("search")
	limitStr := r.URL.Query().Get("limit")
	pageStr  := r.URL.Query().Get("page")
	limit, page := 30, 1
	if l, e := strconv.Atoi(limitStr); e == nil && l > 0 { limit = l }
	if p, e := strconv.Atoi(pageStr);  e == nil && p > 0 { page = p }
	offset := (page - 1) * limit

	where := "WHERE c.is_deleted=0"
	args  := []interface{}{}
	cargs := []interface{}{}
	if search != "" {
		s := "%" + search + "%"
		where += " AND (c.name LIKE ? OR c.phone LIKE ?)"
		args  = append(args, s, s)
		cargs = append(cargs, s, s)
	}

	var total int
	database.DB.QueryRow("SELECT COUNT(*) FROM customers c "+where, cargs...).Scan(&total)

	// Efficient LEFT JOIN instead of correlated subquery
	q := `SELECT c.id, c.name, c.phone, c.address, c.debt_balance,
		c.created_at, c.updated_at,
		COALESCE(ts.total_spend, 0) as total_spend,
		COALESCE(ts.tx_count, 0) as tx_count
		FROM customers c
		LEFT JOIN (
			SELECT customer_id,
				SUM(total_amount) as total_spend,
				COUNT(*) as tx_count
			FROM transactions
			WHERE status='completed' AND is_deleted=0 AND customer_id IS NOT NULL
			GROUP BY customer_id
		) ts ON ts.customer_id = c.id ` + where + " ORDER BY c.name LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	rows, err := database.DB.Query(q, args...)
	if err != nil {
		// Fallback: simpler query if customer_id col not yet migrated
		q2 := "SELECT id, name, phone, address, debt_balance, created_at, updated_at, 0, 0 FROM customers " + where + " ORDER BY name LIMIT ? OFFSET ?"
		a2 := append(cargs, limit, offset)
		rows, err = database.DB.Query(q2, a2...)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
			return
		}
	}
	defer rows.Close()

	var list []models.Customer
	for rows.Next() {
		var c models.Customer
		rows.Scan(&c.ID, &c.Name, &c.Phone, &c.Address, &c.DebtBalance,
			&c.CreatedAt, &c.UpdatedAt, &c.TotalSpend, &c.TxCount)
		list = append(list, c)
	}
	if list == nil { list = []models.Customer{} }
	writeJSON(w, http.StatusOK, models.PaginatedResponse{
		Success: true, Data: list, Total: total, Page: page, Limit: limit,
	})
}

func CreateCustomer(w http.ResponseWriter, r *http.Request) {
	var req models.CustomerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Request tidak valid"}); return
	}
	if req.Name == "" {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Nama pelanggan wajib diisi"}); return
	}
	now := time.Now()
	result, err := database.DB.Exec(
		"INSERT INTO customers (name, phone, address, created_at, updated_at) VALUES (?,?,?,?,?)",
		req.Name, req.Phone, req.Address, now, now,
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal tambah pelanggan"}); return
	}
	id, _ := result.LastInsertId()
	writeJSON(w, http.StatusCreated, models.APIResponse{
		Success: true, Message: "Pelanggan ditambahkan",
		Data: models.Customer{ID: id, Name: req.Name, Phone: req.Phone, Address: req.Address},
	})
}

func UpdateCustomer(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(mux.Vars(r)["id"], 10, 64)
	var req models.CustomerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Request tidak valid"}); return
	}
	if req.Name == "" {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Nama wajib diisi"}); return
	}
	database.DB.Exec(
		"UPDATE customers SET name=?, phone=?, address=?, updated_at=? WHERE id=? AND is_deleted=0",
		req.Name, req.Phone, req.Address, time.Now(), id,
	)
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Message: "Pelanggan diupdate"})
}

func DeleteCustomer(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(mux.Vars(r)["id"], 10, 64)
	var debt float64
	database.DB.QueryRow("SELECT debt_balance FROM customers WHERE id=? AND is_deleted=0", id).Scan(&debt)
	if debt > 0 {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{
			Success: false, Error: "Tidak bisa hapus pelanggan yang masih punya hutang",
		}); return
	}
	database.DB.Exec("UPDATE customers SET is_deleted=1, updated_at=? WHERE id=?", time.Now(), id)
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Message: "Pelanggan dihapus"})
}

func GetCustomerDebt(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(mux.Vars(r)["id"], 10, 64)

	var c models.Customer
	err := database.DB.QueryRow(
		"SELECT id, name, phone, debt_balance FROM customers WHERE id=? AND is_deleted=0", id,
	).Scan(&c.ID, &c.Name, &c.Phone, &c.DebtBalance)
	if err != nil {
		writeJSON(w, http.StatusNotFound, models.APIResponse{Success: false, Error: "Pelanggan tidak ditemukan"}); return
	}

	rows, err := database.DB.Query(
		`SELECT id, customer_id, COALESCE(invoice_number,''), amount, type, note, balance_after, created_at
		 FROM debt_ledger WHERE customer_id=? ORDER BY created_at DESC LIMIT 50`, id,
	)
	if err != nil {
		// debt_ledger table might not exist yet
		writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: map[string]interface{}{
			"customer": c, "ledger": []models.DebtPayment{},
		}}); return
	}
	defer rows.Close()

	var ledger []models.DebtPayment
	for rows.Next() {
		var d models.DebtPayment
		rows.Scan(&d.ID, &d.CustomerID, &d.InvoiceNumber, &d.Amount, &d.Type, &d.Note, &d.BalanceAfter, &d.CreatedAt)
		ledger = append(ledger, d)
	}
	if ledger == nil { ledger = []models.DebtPayment{} }

	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: map[string]interface{}{
		"customer": c, "ledger": ledger,
	}})
}

func RecordDebtPayment(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	var req models.DebtPaymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Request tidak valid"}); return
	}
	if req.Amount <= 0 {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Jumlah bayar harus > 0"}); return
	}

	var current float64
	err := database.DB.QueryRow(
		"SELECT debt_balance FROM customers WHERE id=? AND is_deleted=0", req.CustomerID,
	).Scan(&current)
	if err != nil {
		writeJSON(w, http.StatusNotFound, models.APIResponse{Success: false, Error: "Pelanggan tidak ditemukan"}); return
	}
	if req.Amount > current {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{
			Success: false, Error: fmt.Sprintf("Bayar (%.0f) melebihi hutang (%.0f)", req.Amount, current),
		}); return
	}

	newBalance := current - req.Amount
	tx, _ := database.DB.Begin()
	tx.Exec("UPDATE customers SET debt_balance=?, updated_at=? WHERE id=?", newBalance, time.Now(), req.CustomerID)
	tx.Exec(
		`INSERT INTO debt_ledger (customer_id, amount, type, note, balance_after, created_by, created_at)
		 VALUES (?,?,?,?,?,?,?)`,
		req.CustomerID, req.Amount, "payment", req.Note, newBalance, claims.UserID, time.Now(),
	)
	tx.Commit()

	writeJSON(w, http.StatusOK, models.APIResponse{
		Success: true, Message: "Pembayaran hutang dicatat",
		Data: map[string]interface{}{"new_balance": newBalance},
	})
}
