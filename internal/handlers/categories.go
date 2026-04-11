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

func GetCategories(w http.ResponseWriter, r *http.Request) {
	rows, err := database.DB.Query(
		`SELECT c.id, c.name, c.description, c.color, c.version, c.created_at, c.updated_at,
		 COUNT(p.id) as product_count
		 FROM categories c
		 LEFT JOIN products p ON p.category_id=c.id AND p.is_deleted=0
		 WHERE c.is_deleted=0 GROUP BY c.id ORDER BY c.name`,
	)
	if err != nil { writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()}); return }
	defer rows.Close()

	var cats []models.Category
	for rows.Next() {
		var c models.Category
		rows.Scan(&c.ID, &c.Name, &c.Description, &c.Color,
			&c.AuditFields.Version, &c.AuditFields.CreatedAt, &c.AuditFields.UpdatedAt,
			&c.ProductCount)
		cats = append(cats, c)
	}
	if cats == nil { cats = []models.Category{} }
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: cats})
}

func CreateCategory(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	var req models.CategoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Request tidak valid"}); return
	}
	if req.Name == "" { writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Nama kategori wajib diisi"}); return }
	if req.Color == "" { req.Color = "#005cbb" }

	now := time.Now()
	result, err := database.DB.Exec(
		`INSERT INTO categories (name, description, color, version, created_at, created_by, updated_at, updated_by) VALUES (?,?,?,1,?,?,?,?)`,
		req.Name, req.Description, req.Color, now, claims.UserID, now, claims.UserID,
	)
	if err != nil { writeJSON(w, http.StatusConflict, models.APIResponse{Success: false, Error: "Nama kategori sudah digunakan"}); return }
	id, _ := result.LastInsertId()
	writeJSON(w, http.StatusCreated, models.APIResponse{Success: true, Message: "Kategori ditambahkan",
		Data: models.Category{ID: id, Name: req.Name, Description: req.Description, Color: req.Color}})
}

func UpdateCategory(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	id, _ := strconv.ParseInt(mux.Vars(r)["id"], 10, 64)
	var req models.CategoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Request tidak valid"}); return
	}
	if req.Name == "" { writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Nama kategori wajib diisi"}); return }
	if req.Color == "" { req.Color = "#005cbb" }

	_, err := database.DB.Exec(
		"UPDATE categories SET name=?, description=?, color=?, updated_at=?, updated_by=?, version=version+1 WHERE id=? AND is_deleted=0",
		req.Name, req.Description, req.Color, time.Now(), claims.UserID, id,
	)
	if err != nil { writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal update kategori"}); return }
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Message: "Kategori diupdate"})
}

func DeleteCategory(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	id, _ := strconv.ParseInt(mux.Vars(r)["id"], 10, 64)
	// Check if any products still use this category
	var count int
	database.DB.QueryRow("SELECT COUNT(*) FROM products WHERE category_id=? AND is_deleted=0", id).Scan(&count)
	if count > 0 {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Tidak bisa hapus kategori yang masih digunakan produk"}); return
	}
	database.DB.Exec("UPDATE categories SET is_deleted=1, updated_at=?, updated_by=? WHERE id=?", time.Now(), claims.UserID, id)
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Message: "Kategori dihapus"})
}
