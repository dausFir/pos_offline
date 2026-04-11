package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"kasir-umkm/internal/database"
	"kasir-umkm/internal/models"
)

func GetDiscounts(w http.ResponseWriter, r *http.Request) {
	rows, err := database.DB.Query(
		"SELECT id, code, name, type, value, min_purchase, is_active, created_at FROM discounts ORDER BY created_at DESC",
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	defer rows.Close()

	var discounts []models.Discount
	for rows.Next() {
		var d models.Discount
		var isActive int
		rows.Scan(&d.ID, &d.Code, &d.Name, &d.Type, &d.Value, &d.MinPurchase, &isActive, &d.CreatedAt)
		d.IsActive = isActive == 1
		discounts = append(discounts, d)
	}
	if discounts == nil {
		discounts = []models.Discount{}
	}
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: discounts})
}

func ValidateDiscountCode(w http.ResponseWriter, r *http.Request) {
	code := mux.Vars(r)["code"]
	totalStr := r.URL.Query().Get("total")
	total, _ := strconv.ParseFloat(totalStr, 64)

	var d models.Discount
	var isActive int
	err := database.DB.QueryRow(
		"SELECT id, code, name, type, value, min_purchase, is_active FROM discounts WHERE code = ? COLLATE NOCASE",
		code,
	).Scan(&d.ID, &d.Code, &d.Name, &d.Type, &d.Value, &d.MinPurchase, &isActive)
	if err != nil {
		writeJSON(w, http.StatusNotFound, models.APIResponse{Success: false, Error: "Kode diskon tidak ditemukan"})
		return
	}
	d.IsActive = isActive == 1

	if !d.IsActive {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Kode diskon tidak aktif"})
		return
	}
	if total > 0 && total < d.MinPurchase {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "Minimal pembelian tidak terpenuhi",
		})
		return
	}

	// Calculate discount amount
	var discountAmount float64
	if d.Type == "percent" {
		discountAmount = total * d.Value / 100
	} else {
		discountAmount = d.Value
		if discountAmount > total {
			discountAmount = total
		}
	}

	writeJSON(w, http.StatusOK, models.APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"discount":        d,
			"discount_amount": discountAmount,
			"final_total":     total - discountAmount,
		},
	})
}

func CreateDiscount(w http.ResponseWriter, r *http.Request) {
	var req models.DiscountRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Request tidak valid"})
		return
	}
	if req.Code == "" || req.Name == "" {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Kode dan nama wajib diisi"})
		return
	}
	if req.Type != "percent" && req.Type != "fixed" {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Tipe harus 'percent' atau 'fixed'"})
		return
	}
	if req.Value <= 0 {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Nilai diskon harus lebih dari 0"})
		return
	}
	if req.Type == "percent" && req.Value > 100 {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Diskon persen maksimal 100%"})
		return
	}

	isActive := 0
	if req.IsActive {
		isActive = 1
	}

	result, err := database.DB.Exec(
		"INSERT INTO discounts (code, name, type, value, min_purchase, is_active) VALUES (?,?,?,?,?,?)",
		req.Code, req.Name, req.Type, req.Value, req.MinPurchase, isActive,
	)
	if err != nil {
		writeJSON(w, http.StatusConflict, models.APIResponse{Success: false, Error: "Kode diskon sudah digunakan"})
		return
	}
	id, _ := result.LastInsertId()
	writeJSON(w, http.StatusCreated, models.APIResponse{
		Success: true, Message: "Diskon berhasil ditambahkan",
		Data: map[string]interface{}{"id": id},
	})
}

func UpdateDiscount(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(mux.Vars(r)["id"], 10, 64)
	var req models.DiscountRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Request tidak valid"})
		return
	}
	isActive := 0
	if req.IsActive {
		isActive = 1
	}
	_, err := database.DB.Exec(
		"UPDATE discounts SET code=?, name=?, type=?, value=?, min_purchase=?, is_active=? WHERE id=?",
		req.Code, req.Name, req.Type, req.Value, req.MinPurchase, isActive, id,
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal update diskon"})
		return
	}
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Message: "Diskon berhasil diupdate"})
}

func DeleteDiscount(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(mux.Vars(r)["id"], 10, 64)
	database.DB.Exec("DELETE FROM discounts WHERE id = ?", id)
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Message: "Diskon dihapus"})
}
