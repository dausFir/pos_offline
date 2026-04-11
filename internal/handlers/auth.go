package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	"kasir-umkm/internal/database"
	"kasir-umkm/internal/middleware"
	"kasir-umkm/internal/models"
)

func Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Request tidak valid"}); return
	}
	if req.Username == "" || req.Password == "" {
		logLogin(0, req.Username, r, "failed", "username/password kosong")
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Username dan password wajib diisi"}); return
	}

	var user models.User
	err := database.DB.QueryRow(
		"SELECT id, username, password_hash, role, version, created_at, updated_at FROM users WHERE username=? AND is_deleted=0",
		req.Username,
	).Scan(&user.ID, &user.Username, &user.PasswordHash, &user.Role,
		&user.AuditFields.Version, &user.AuditFields.CreatedAt, &user.AuditFields.UpdatedAt)

	if err != nil {
		logLogin(0, req.Username, r, "failed", "username tidak ditemukan")
		writeJSON(w, http.StatusUnauthorized, models.APIResponse{Success: false, Error: "Username atau password salah"}); return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		logLogin(user.ID, req.Username, r, "failed", "password salah")
		writeJSON(w, http.StatusUnauthorized, models.APIResponse{Success: false, Error: "Username atau password salah"}); return
	}

	token, err := middleware.GenerateToken(user)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal membuat token"}); return
	}
	logLogin(user.ID, req.Username, r, "success", "")
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: models.LoginResponse{Token: token, User: user}})
}

func GetMe(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	writeJSON(w, http.StatusOK, models.APIResponse{
		Success: true,
		Data: map[string]interface{}{"id": claims.UserID, "username": claims.Username, "role": claims.Role},
	})
}

// Kritis #1 — ganti password sendiri (semua role)
func ChangePassword(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	var req models.ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Request tidak valid"}); return
	}
	if req.CurrentPassword == "" || req.NewPassword == "" {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Password lama dan baru wajib diisi"}); return
	}
	if len(req.NewPassword) < 6 {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Password baru minimal 6 karakter"}); return
	}
	var hash string
	database.DB.QueryRow("SELECT password_hash FROM users WHERE id=? AND is_deleted=0", claims.UserID).Scan(&hash)
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.CurrentPassword)); err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Password lama tidak sesuai"}); return
	}
	newHash, _ := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	database.DB.Exec(
		"UPDATE users SET password_hash=?, updated_at=?, updated_by=?, version=version+1 WHERE id=?",
		string(newHash), time.Now(), claims.UserID, claims.UserID,
	)
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Message: "Password berhasil diubah"})
}

// Kritis #7 — riwayat login (admin+)
func GetLoginLogs(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	limit := 50
	if l, err := fmt.Sscanf(limitStr, "%d", &limit); l < 1 || err != nil { limit = 50 }

	rows, err := database.DB.Query(
		`SELECT id, COALESCE(user_id,0), username, ip_address, user_agent, status, reason, created_at
		 FROM login_logs ORDER BY created_at DESC LIMIT ?`, limit,
	)
	if err != nil { writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()}); return }
	defer rows.Close()

	var logs []models.LoginLog
	for rows.Next() {
		var l models.LoginLog
		rows.Scan(&l.ID, &l.UserID, &l.Username, &l.IPAddress, &l.UserAgent, &l.Status, &l.Reason, &l.CreatedAt)
		logs = append(logs, l)
	}
	if logs == nil { logs = []models.LoginLog{} }
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: logs})
}

func logLogin(userID int64, username string, r *http.Request, status, reason string) {
	ip := r.RemoteAddr
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" { ip = strings.Split(xff, ",")[0] }
	ua := r.Header.Get("User-Agent")
	if len(ua) > 200 { ua = ua[:200] }
	database.DB.Exec(
		"INSERT INTO login_logs (user_id, username, ip_address, user_agent, status, reason) VALUES (?,?,?,?,?,?)",
		userID, username, ip, ua, status, reason,
	)
}
