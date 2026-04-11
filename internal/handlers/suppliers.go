package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"kasir-umkm/internal/database"
	"kasir-umkm/internal/models"
)

func GetSuppliers(w http.ResponseWriter, r *http.Request) {
	search := r.URL.Query().Get("search")
	base := "FROM suppliers WHERE is_deleted=0"
	args := []interface{}{}
	if search != "" {
		s := "%" + search + "%"
		base += " AND (name LIKE ? OR phone LIKE ? OR contact_name LIKE ?)"
		args = append(args, s, s, s)
	}

	var total int
	database.DB.QueryRow("SELECT COUNT(*) "+base, args...).Scan(&total)

	args = append(args, 100, 0)
	rows, err := database.DB.Query("SELECT id, name, phone, address, contact_name, created_at, updated_at "+base+" ORDER BY name LIMIT ? OFFSET ?", args...)
	if err != nil { writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()}); return }
	defer rows.Close()

	var list []models.Supplier
	for rows.Next() {
		var s models.Supplier
		rows.Scan(&s.ID, &s.Name, &s.Phone, &s.Address, &s.ContactName, &s.CreatedAt, &s.UpdatedAt)
		list = append(list, s)
	}
	if list == nil { list = []models.Supplier{} }
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: list})
}

func CreateSupplier(w http.ResponseWriter, r *http.Request) {
	var req models.SupplierRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Request tidak valid"}); return
	}
	if req.Name == "" { writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Nama supplier wajib diisi"}); return }

	now := time.Now()
	result, err := database.DB.Exec(
		"INSERT INTO suppliers (name, phone, address, contact_name, created_at, updated_at) VALUES (?,?,?,?,?,?)",
		req.Name, req.Phone, req.Address, req.ContactName, now, now,
	)
	if err != nil { writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal tambah supplier"}); return }
	id, _ := result.LastInsertId()
	writeJSON(w, http.StatusCreated, models.APIResponse{Success: true, Message: "Supplier ditambahkan",
		Data: models.Supplier{ID: id, Name: req.Name, Phone: req.Phone, ContactName: req.ContactName}})
}

func UpdateSupplier(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(mux.Vars(r)["id"], 10, 64)
	var req models.SupplierRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Request tidak valid"}); return
	}
	if req.Name == "" { writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Nama wajib diisi"}); return }
	database.DB.Exec("UPDATE suppliers SET name=?, phone=?, address=?, contact_name=?, updated_at=? WHERE id=? AND is_deleted=0",
		req.Name, req.Phone, req.Address, req.ContactName, time.Now(), id)
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Message: "Supplier diupdate"})
}

func DeleteSupplier(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(mux.Vars(r)["id"], 10, 64)
	database.DB.Exec("UPDATE suppliers SET is_deleted=1, updated_at=? WHERE id=?", time.Now(), id)
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Message: "Supplier dihapus"})
}
