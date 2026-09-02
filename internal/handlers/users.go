package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"golang.org/x/crypto/bcrypt"
	"kasir-umkm/internal/database"
	"kasir-umkm/internal/middleware"
	"kasir-umkm/internal/models"
)

func GetUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := database.DB.Query(
		`SELECT id, username, role, version, created_at, updated_at FROM users WHERE is_deleted=0 ORDER BY created_at`,
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	defer rows.Close()
	var users []models.User
	for rows.Next() {
		var u models.User
		rows.Scan(&u.ID, &u.Username, &u.Role,
			&u.AuditFields.Version, &u.AuditFields.CreatedAt, &u.AuditFields.UpdatedAt)
		users = append(users, u)
	}
	if users == nil {
		users = []models.User{}
	}
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: users})
}

func CreateUser(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	var req models.UserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Request tidak valid"})
		return
	}
	if req.Username == "" || len(req.Password) < 12 {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Username wajib diisi dan password minimal 12 karakter"})
		return
	}
	validRoles := map[string]bool{"super_admin": true, "admin": true, "cashier": true}
	if !validRoles[req.Role] {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Role tidak valid"})
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal hash password"})
		return
	}

	now := time.Now()
	result, err := database.DB.Exec(
		`INSERT INTO users (username, password_hash, role, version, created_at, created_by, updated_at, updated_by)
		 VALUES (?,?,?,1,?,?,?,?)`,
		req.Username, string(hash), req.Role, now, claims.UserID, now, claims.UserID,
	)
	if err != nil {
		writeJSON(w, http.StatusConflict, models.APIResponse{Success: false, Error: "Username sudah digunakan"})
		return
	}
	id, _ := result.LastInsertId()
	writeJSON(w, http.StatusCreated, models.APIResponse{Success: true, Message: "User berhasil ditambahkan",
		Data: map[string]interface{}{"id": id, "username": req.Username, "role": req.Role}})
}

func DeleteUser(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	idStr := mux.Vars(r)["id"]
	if idStr == "" {
		idStr = r.URL.Query().Get("id")
	}
	targetID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "ID tidak valid"})
		return
	}
	if targetID == claims.UserID {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Tidak bisa hapus akun sendiri"})
		return
	}
	// Check role of target — cannot delete super_admin
	var role string
	database.DB.QueryRow("SELECT role FROM users WHERE id=? AND is_deleted=0", targetID).Scan(&role)
	if role == "super_admin" {
		writeJSON(w, http.StatusForbidden, models.APIResponse{Success: false, Error: "Tidak bisa menghapus akun super_admin"})
		return
	}
	now := time.Now()
	database.DB.Exec(
		`UPDATE users SET is_deleted=1, deleted_at=?, deleted_by=?, version=version+1 WHERE id=? AND is_deleted=0`,
		now, claims.UserID, targetID,
	)
	database.DB.Exec("UPDATE sessions SET is_active=0 WHERE user_id=?", targetID)
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Message: "User berhasil dihapus"})
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// UpdateUser — super_admin bisa edit role & reset password user lain
func UpdateUser(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	vars := mux.Vars(r)
	targetID, _ := strconv.ParseInt(vars["id"], 10, 64)

	if targetID == claims.UserID {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{
			Success: false, Error: "Tidak bisa edit akun sendiri dari sini — gunakan halaman Profil",
		})
		return
	}

	var req struct {
		Role        string `json:"role"`
		NewPassword string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Request tidak valid"})
		return
	}

	validRoles := map[string]bool{"cashier": true, "admin": true, "super_admin": true}
	if req.Role != "" && !validRoles[req.Role] {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Role tidak valid"})
		return
	}

	// Check target user exists
	var existingRole string
	if err := database.DB.QueryRow("SELECT role FROM users WHERE id=? AND is_deleted=0", targetID).Scan(&existingRole); err != nil {
		writeJSON(w, http.StatusNotFound, models.APIResponse{Success: false, Error: "Pengguna tidak ditemukan"})
		return
	}

	now := time.Now()
	if req.NewPassword != "" {
		if len(req.NewPassword) < 12 {
			writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Password baru minimal 12 karakter"})
			return
		}
		hash, _ := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
		database.DB.Exec(
			"UPDATE users SET password_hash=?, updated_at=?, updated_by=?, version=version+1 WHERE id=?",
			string(hash), now, claims.UserID, targetID,
		)
		database.DB.Exec("UPDATE sessions SET is_active=0 WHERE user_id=?", targetID)
	}

	if req.Role != "" && req.Role != existingRole {
		database.DB.Exec(
			"UPDATE users SET role=?, updated_at=?, updated_by=?, version=version+1 WHERE id=?",
			req.Role, now, claims.UserID, targetID,
		)
	}

	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Message: "Pengguna berhasil diupdate"})
}
