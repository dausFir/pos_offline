package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"kasir-umkm/internal/database"
	"kasir-umkm/internal/middleware"
	"kasir-umkm/internal/models"
)

func GetProducts(w http.ResponseWriter, r *http.Request) {
	search      := r.URL.Query().Get("search")
	catIDStr    := r.URL.Query().Get("category_id")
	lowStockStr := r.URL.Query().Get("low_stock")
	limitStr    := r.URL.Query().Get("limit")
	pageStr     := r.URL.Query().Get("page")
	limit, page := 50, 1
	if l, e := strconv.Atoi(limitStr); e == nil && l > 0 { limit = l }
	if p, e := strconv.Atoi(pageStr);  e == nil && p > 0 { page = p }
	offset := (page-1)*limit

	base := `FROM products p LEFT JOIN categories c ON p.category_id=c.id WHERE p.is_deleted=0`
	args, cargs := []interface{}{}, []interface{}{}

	if search != "" {
		s := "%"+search+"%"
		base += " AND (p.name LIKE ? OR p.barcode_sku LIKE ?)"
		args  = append(args, s, s);  cargs = append(cargs, s, s)
	}
	if catIDStr != "" && catIDStr != "0" {
		base += " AND p.category_id=?"
		args  = append(args, catIDStr);  cargs = append(cargs, catIDStr)
	}
	if lowStockStr == "1" {
		base += " AND p.stock <= p.stock_min"
	}

	var total int
	database.DB.QueryRow("SELECT COUNT(*) "+base, cargs...).Scan(&total)

	q := `SELECT p.id, p.barcode_sku, p.name,
		COALESCE(p.category_id,0), COALESCE(c.name,''),
		p.buy_price, p.sell_price, p.stock, p.stock_min, p.item_type,
		p.version, p.created_at, p.updated_at ` + base + " ORDER BY p.name LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	rows, err := database.DB.Query(q, args...)
	if err != nil { writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()}); return }
	defer rows.Close()

	var products []models.Product
	for rows.Next() {
		var p models.Product
		rows.Scan(&p.ID, &p.BarcodeSKU, &p.Name,
			&p.CategoryIDv, &p.CategoryName,
			&p.BuyPrice, &p.SellPrice, &p.Stock, &p.StockMin, &p.ItemType,
			&p.AuditFields.Version, &p.AuditFields.CreatedAt, &p.AuditFields.UpdatedAt)
		p.Profit    = p.SellPrice - p.BuyPrice
		if p.BuyPrice > 0 { p.MarginPct = p.Profit / p.BuyPrice * 100 }
		products = append(products, p)
	}
	if products == nil { products = []models.Product{} }
	writeJSON(w, http.StatusOK, models.PaginatedResponse{Success: true, Data: products, Total: total, Page: page, Limit: limit})
}

func GetProductByBarcode(w http.ResponseWriter, r *http.Request) {
	barcode := mux.Vars(r)["barcode"]
	var p models.Product
	err := database.DB.QueryRow(
		`SELECT p.id, p.barcode_sku, p.name, COALESCE(p.category_id,0), COALESCE(c.name,''),
		 p.buy_price, p.sell_price, p.stock, p.stock_min, p.item_type, p.version, p.created_at, p.updated_at
		 FROM products p LEFT JOIN categories c ON p.category_id=c.id
		 WHERE p.barcode_sku=? AND p.is_deleted=0`, barcode,
	).Scan(&p.ID, &p.BarcodeSKU, &p.Name, &p.CategoryIDv, &p.CategoryName,
		&p.BuyPrice, &p.SellPrice, &p.Stock, &p.StockMin, &p.ItemType,
		&p.AuditFields.Version, &p.AuditFields.CreatedAt, &p.AuditFields.UpdatedAt)
	if err != nil { writeJSON(w, http.StatusNotFound, models.APIResponse{Success: false, Error: "Produk tidak ditemukan"}); return }
	p.Profit = p.SellPrice - p.BuyPrice
	if p.BuyPrice > 0 { p.MarginPct = p.Profit / p.BuyPrice * 100 }
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: p})
}

func GetProduct(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(mux.Vars(r)["id"], 10, 64)
	var p models.Product
	err := database.DB.QueryRow(
		`SELECT p.id, p.barcode_sku, p.name, COALESCE(p.category_id,0), COALESCE(c.name,''),
		 p.buy_price, p.sell_price, p.stock, p.stock_min, p.item_type, p.version, p.created_at, p.updated_at
		 FROM products p LEFT JOIN categories c ON p.category_id=c.id
		 WHERE p.id=? AND p.is_deleted=0`, id,
	).Scan(&p.ID, &p.BarcodeSKU, &p.Name, &p.CategoryIDv, &p.CategoryName,
		&p.BuyPrice, &p.SellPrice, &p.Stock, &p.StockMin, &p.ItemType,
		&p.AuditFields.Version, &p.AuditFields.CreatedAt, &p.AuditFields.UpdatedAt)
	if err != nil { writeJSON(w, http.StatusNotFound, models.APIResponse{Success: false, Error: "Produk tidak ditemukan"}); return }
	p.Profit = p.SellPrice - p.BuyPrice
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: p})
}

func CreateProduct(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	var req models.ProductRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Request tidak valid"}); return
	}
	if req.BarcodeSKU == "" || req.Name == "" {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Barcode/SKU dan nama wajib diisi"}); return
	}
	if req.StockMin < 0 { req.StockMin = 5 }
	if req.ItemType == "" { req.ItemType = "physical" }
	if req.ItemType != "physical" && req.ItemType != "service" { writeJSON(w, http.StatusBadRequest, models.APIResponse{Success:false,Error:"Tipe item tidak valid"}); return }
	if req.ItemType == "service" { req.Stock, req.StockMin = 0, 0 }

	now := time.Now()
	var catID interface{} = nil
	if req.CategoryID > 0 { catID = req.CategoryID }

	result, err := database.DB.Exec(
		`INSERT INTO products (barcode_sku,name,category_id,buy_price,sell_price,stock,stock_min,item_type,version,created_at,created_by,updated_at,updated_by)
		 VALUES (?,?,?,?,?,?,?, ?,1,?,?,?,?)`,
		req.BarcodeSKU, req.Name, catID, req.BuyPrice, req.SellPrice, req.Stock, req.StockMin, req.ItemType,
		now, claims.UserID, now, claims.UserID,
	)
	if err != nil { writeJSON(w, http.StatusConflict, models.APIResponse{Success: false, Error: "Barcode/SKU sudah digunakan"}); return }
	id, _ := result.LastInsertId()
	writeJSON(w, http.StatusCreated, models.APIResponse{Success: true, Message: "Produk berhasil ditambahkan",
		Data: models.Product{ID: id, BarcodeSKU: req.BarcodeSKU, Name: req.Name,
			BuyPrice: req.BuyPrice, SellPrice: req.SellPrice, Stock: req.Stock, StockMin: req.StockMin, ItemType:req.ItemType}})
}

func UpdateProduct(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	id, _ := strconv.ParseInt(mux.Vars(r)["id"], 10, 64)
	var req models.ProductRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Request tidak valid"}); return
	}
	if req.BarcodeSKU == "" || req.Name == "" {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Barcode/SKU dan nama wajib diisi"}); return
	}
	if req.StockMin < 0 { req.StockMin = 5 }
	if req.ItemType == "" { req.ItemType = "physical" }
	if req.ItemType != "physical" && req.ItemType != "service" { writeJSON(w, http.StatusBadRequest, models.APIResponse{Success:false,Error:"Tipe item tidak valid"}); return }
	if req.ItemType == "service" { req.Stock, req.StockMin = 0, 0 }

	// Track price changes
	var oldBuy, oldSell float64
	database.DB.QueryRow("SELECT buy_price, sell_price FROM products WHERE id=? AND is_deleted=0", id).Scan(&oldBuy, &oldSell)
	if oldBuy != req.BuyPrice || oldSell != req.SellPrice {
		database.DB.Exec(
			`INSERT INTO price_history (product_id, old_buy, new_buy, old_sell, new_sell, changed_by, created_at) VALUES (?,?,?,?,?,?,?)`,
			id, oldBuy, req.BuyPrice, oldSell, req.SellPrice, claims.UserID, time.Now(),
		)
	}

	var catID interface{} = nil
	if req.CategoryID > 0 { catID = req.CategoryID }

	_, err := database.DB.Exec(
		`UPDATE products SET barcode_sku=?,name=?,category_id=?,buy_price=?,sell_price=?,stock=?,stock_min=?,item_type=?,
		 updated_at=?,updated_by=?,version=version+1 WHERE id=? AND is_deleted=0`,
		req.BarcodeSKU, req.Name, catID, req.BuyPrice, req.SellPrice, req.Stock, req.StockMin, req.ItemType,
		time.Now(), claims.UserID, id,
	)
	if err != nil { writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal update produk"}); return }
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Message: "Produk berhasil diupdate"})
}

func DeleteProduct(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	id, _ := strconv.ParseInt(mux.Vars(r)["id"], 10, 64)
	_, err := database.DB.Exec(
		"UPDATE products SET is_deleted=1,deleted_at=?,deleted_by=?,version=version+1 WHERE id=? AND is_deleted=0",
		time.Now(), claims.UserID, id,
	)
	if err != nil { writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal hapus produk"}); return }
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Message: "Produk berhasil dihapus"})
}

func GetProductStockHistory(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(mux.Vars(r)["id"], 10, 64)
	rows, err := database.DB.Query(
		`SELECT sm.id, sm.product_id, p.name, p.barcode_sku,
		sm.type, sm.quantity, sm.stock_before, sm.stock_after,
		sm.note, sm.user_id, COALESCE(u.username,'?'), sm.created_at
		FROM stock_mutations sm
		LEFT JOIN products p ON sm.product_id=p.id
		LEFT JOIN users u ON sm.user_id=u.id
		WHERE sm.product_id=? ORDER BY sm.created_at DESC LIMIT 60`, id,
	)
	if err != nil { writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()}); return }
	defer rows.Close()
	var list []models.StockMutation
	for rows.Next() {
		var m models.StockMutation
		rows.Scan(&m.ID, &m.ProductID, &m.ProductName, &m.BarcodeSKU,
			&m.Type, &m.Quantity, &m.StockBefore, &m.StockAfter,
			&m.Note, &m.UserID, &m.Username, &m.CreatedAt)
		list = append(list, m)
	}
	if list == nil { list = []models.StockMutation{} }
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: list})
}

func GetPriceHistory(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(mux.Vars(r)["id"], 10, 64)
	rows, err := database.DB.Query(
		`SELECT ph.id, ph.product_id, p.name, ph.old_buy, ph.new_buy, ph.old_sell, ph.new_sell,
		 COALESCE(u.username,'?'), ph.created_at
		 FROM price_history ph
		 LEFT JOIN products p ON ph.product_id=p.id
		 LEFT JOIN users u ON ph.changed_by=u.id
		 WHERE ph.product_id=? ORDER BY ph.created_at DESC LIMIT 30`, id,
	)
	if err != nil { writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()}); return }
	defer rows.Close()

	type PriceLog struct {
		ID          int64     `json:"id"`
		ProductID   int64     `json:"product_id"`
		ProductName string    `json:"product_name"`
		OldBuy      float64   `json:"old_buy"`
		NewBuy      float64   `json:"new_buy"`
		OldSell     float64   `json:"old_sell"`
		NewSell     float64   `json:"new_sell"`
		ChangedBy   string    `json:"changed_by"`
		CreatedAt   time.Time `json:"created_at"`
	}
	var logs []PriceLog
	for rows.Next() {
		var l PriceLog
		rows.Scan(&l.ID, &l.ProductID, &l.ProductName, &l.OldBuy, &l.NewBuy, &l.OldSell, &l.NewSell, &l.ChangedBy, &l.CreatedAt)
		logs = append(logs, l)
	}
	if logs == nil { logs = []PriceLog{} }
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: logs})
}
