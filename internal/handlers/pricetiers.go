package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"kasir-umkm/internal/database"
	"kasir-umkm/internal/models"
)

func GetPriceTiers(w http.ResponseWriter, r *http.Request) {
	productID := mux.Vars(r)["product_id"]
	rows, err := database.DB.Query(
		"SELECT id, product_id, label, min_qty, price, created_at FROM price_tiers WHERE product_id=? ORDER BY min_qty",
		productID,
	)
	if err != nil { writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()}); return }
	defer rows.Close()

	var tiers []models.PriceTier
	for rows.Next() {
		var t models.PriceTier
		rows.Scan(&t.ID, &t.ProductID, &t.Label, &t.MinQty, &t.Price, &t.CreatedAt)
		tiers = append(tiers, t)
	}
	if tiers == nil { tiers = []models.PriceTier{} }
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: tiers})
}

func CreatePriceTier(w http.ResponseWriter, r *http.Request) {
	var req models.PriceTierRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Request tidak valid"}); return
	}
	if req.ProductID == 0 || req.Price <= 0 || req.MinQty <= 0 {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "ProductID, harga, dan minimal qty wajib diisi"}); return
	}
	result, err := database.DB.Exec(
		"INSERT INTO price_tiers (product_id, label, min_qty, price) VALUES (?,?,?,?)",
		req.ProductID, req.Label, req.MinQty, req.Price,
	)
	if err != nil { writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal simpan harga tier"}); return }
	id, _ := result.LastInsertId()
	writeJSON(w, http.StatusCreated, models.APIResponse{Success: true, Message: "Harga tier ditambahkan", Data: map[string]interface{}{"id": id}})
}

func DeletePriceTier(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(mux.Vars(r)["id"], 10, 64)
	database.DB.Exec("DELETE FROM price_tiers WHERE id=?", id)
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Message: "Harga tier dihapus"})
}

// GetProductWithTiers — used by POS to resolve best price for qty
func GetProductTierPrice(w http.ResponseWriter, r *http.Request) {
	productID := mux.Vars(r)["product_id"]
	qtyStr := r.URL.Query().Get("qty")
	qty, _ := strconv.Atoi(qtyStr)

	var basePrice float64
	database.DB.QueryRow("SELECT sell_price FROM products WHERE id=? AND is_deleted=0", productID).Scan(&basePrice)

	// Find best tier price for qty
	var tierPrice float64
	var tierLabel string
	database.DB.QueryRow(
		"SELECT price, label FROM price_tiers WHERE product_id=? AND min_qty<=? ORDER BY min_qty DESC LIMIT 1",
		productID, qty,
	).Scan(&tierPrice, &tierLabel)

	if tierPrice > 0 && tierPrice < basePrice {
		writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: map[string]interface{}{
			"price": tierPrice, "label": tierLabel, "is_tier": true,
		}})
	} else {
		writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: map[string]interface{}{
			"price": basePrice, "label": "Harga Normal", "is_tier": false,
		}})
	}
}
