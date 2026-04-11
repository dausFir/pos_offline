package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"kasir-umkm/internal/database"
	"kasir-umkm/internal/middleware"
	"kasir-umkm/internal/models"
)

// LogStockMutation records a mutation inside a DB transaction (used by checkout)
func LogStockMutation(tx interface {
	Exec(string, ...interface{}) (interface {
		LastInsertId() (int64, error)
		RowsAffected() (int64, error)
	}, error)
}, productID int64, mutType string, qty, stockBefore, stockAfter int, note string, userID int64) {
	// best-effort log; ignore errors
	database.DB.Exec(
		"INSERT INTO stock_mutations (product_id, type, quantity, stock_before, stock_after, note, user_id, created_at) VALUES (?,?,?,?,?,?,?,?)",
		productID, mutType, qty, stockBefore, stockAfter, note, userID, time.Now(),
	)
}

func GetStockMutations(w http.ResponseWriter, r *http.Request) {
	productIDStr := r.URL.Query().Get("product_id")
	limitStr := r.URL.Query().Get("limit")
	pageStr := r.URL.Query().Get("page")

	limit := 30
	page := 1
	if l, _ := strconv.Atoi(limitStr); l > 0 {
		limit = l
	}
	if p, _ := strconv.Atoi(pageStr); p > 0 {
		page = p
	}
	offset := (page - 1) * limit

	baseQ := `FROM stock_mutations sm
		LEFT JOIN products p ON sm.product_id = p.id
		LEFT JOIN users u ON sm.user_id = u.id
		WHERE 1=1`
	args := []interface{}{}
	countArgs := []interface{}{}

	if productIDStr != "" {
		baseQ += " AND sm.product_id = ?"
		args = append(args, productIDStr)
		countArgs = append(countArgs, productIDStr)
	}

	var total int
	database.DB.QueryRow("SELECT COUNT(*) "+baseQ, countArgs...).Scan(&total)

	query := `SELECT sm.id, sm.product_id, p.name, p.barcode_sku,
		sm.type, sm.quantity, sm.stock_before, sm.stock_after,
		sm.note, sm.user_id, u.username, sm.created_at ` +
		baseQ + " ORDER BY sm.created_at DESC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	defer rows.Close()

	var mutations []models.StockMutation
	for rows.Next() {
		var m models.StockMutation
		rows.Scan(&m.ID, &m.ProductID, &m.ProductName, &m.BarcodeSKU,
			&m.Type, &m.Quantity, &m.StockBefore, &m.StockAfter,
			&m.Note, &m.UserID, &m.Username, &m.CreatedAt)
		mutations = append(mutations, m)
	}
	if mutations == nil {
		mutations = []models.StockMutation{}
	}

	writeJSON(w, http.StatusOK, models.PaginatedResponse{
		Success: true, Data: mutations, Total: total, Page: page, Limit: limit,
	})
}

func CreateStockMutation(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	var req models.StockMutationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Request tidak valid"})
		return
	}

	if req.ProductID == 0 {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Product ID wajib diisi"})
		return
	}
	if req.Type != "in" && req.Type != "out" && req.Type != "adjustment" {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Tipe mutasi tidak valid (in/out/adjustment)"})
		return
	}
	if req.Quantity <= 0 {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Kuantitas harus lebih dari 0"})
		return
	}

	// Get current stock
	var product models.Product
	err := database.DB.QueryRow(
		"SELECT id, name, stock FROM products WHERE id = ?", req.ProductID,
	).Scan(&product.ID, &product.Name, &product.Stock)
	if err != nil {
		writeJSON(w, http.StatusNotFound, models.APIResponse{Success: false, Error: "Produk tidak ditemukan"})
		return
	}

	stockBefore := product.Stock
	var stockAfter int

	switch req.Type {
	case "in":
		stockAfter = stockBefore + req.Quantity
	case "out":
		if stockBefore < req.Quantity {
			writeJSON(w, http.StatusBadRequest, models.APIResponse{
				Success: false,
				Error:   "Stok tidak cukup untuk pengurangan",
			})
			return
		}
		stockAfter = stockBefore - req.Quantity
	case "adjustment":
		stockAfter = req.Quantity // absolute value
	}

	// Apply stock change in a transaction
	tx, err := database.DB.Begin()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal memulai transaksi"})
		return
	}

	_, err = tx.Exec("UPDATE products SET stock = ?, updated_at = ? WHERE id = ?",
		stockAfter, time.Now(), req.ProductID)
	if err != nil {
		tx.Rollback()
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal update stok"})
		return
	}

	quantityLog := req.Quantity
	if req.Type == "adjustment" {
		quantityLog = stockAfter - stockBefore
	}

	_, err = tx.Exec(
		"INSERT INTO stock_mutations (product_id, type, quantity, stock_before, stock_after, note, user_id, created_at) VALUES (?,?,?,?,?,?,?,?)",
		req.ProductID, req.Type, quantityLog, stockBefore, stockAfter, req.Note, claims.UserID, time.Now(),
	)
	if err != nil {
		tx.Rollback()
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal catat mutasi"})
		return
	}

	tx.Commit()

	writeJSON(w, http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "Mutasi stok berhasil dicatat",
		Data: models.StockMutation{
			ProductID:   req.ProductID,
			ProductName: product.Name,
			Type:        req.Type,
			Quantity:    quantityLog,
			StockBefore: stockBefore,
			StockAfter:  stockAfter,
			Note:        req.Note,
			UserID:      claims.UserID,
		},
	})
}
