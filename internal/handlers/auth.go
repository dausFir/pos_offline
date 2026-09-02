package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"kasir-umkm/internal/database"
	"kasir-umkm/internal/middleware"
	"kasir-umkm/internal/models"

	"golang.org/x/crypto/bcrypt"
)

// Login with refresh token
func Login(w http.ResponseWriter, r *http.Request) {

	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		fmt.Printf("❌ [LOGIN] JSON decode error: %v\n", err)
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Request tidak valid"})
		return
	}


	if req.Username == "" || req.Password == "" {
		logLogin(0, req.Username, r, "failed", "username/password kosong")
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Username dan password wajib diisi"})
		return
	}

	var user models.User
	err := database.DB.QueryRow(
		"SELECT id, username, password_hash, role, version, created_at, updated_at FROM users WHERE username=? AND is_deleted=0",
		req.Username,
	).Scan(&user.ID, &user.Username, &user.PasswordHash, &user.Role,
		&user.AuditFields.Version, &user.AuditFields.CreatedAt, &user.AuditFields.UpdatedAt)

	if err != nil {
		logLogin(0, req.Username, r, "failed", "username tidak ditemukan")
		writeJSON(w, http.StatusUnauthorized, models.APIResponse{Success: false, Error: "Username atau password salah"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		logLogin(user.ID, req.Username, r, "failed", "password salah")
		writeJSON(w, http.StatusUnauthorized, models.APIResponse{Success: false, Error: "Username atau password salah"})
		return
	}

	// Generate access & refresh tokens
	accessToken, err := middleware.GenerateAccessToken(user)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal membuat token"})
		return
	}

	refreshToken, err := middleware.GenerateRefreshToken()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal membuat refresh token"})
		return
	}

	// Store refresh token in database
	refreshTokenHash := middleware.HashRefreshToken(refreshToken)
	deviceInfo := r.Header.Get("User-Agent")
	ipAddress := getClientIP(r)
	expiresAt := time.Now().Add(middleware.RefreshTokenDuration)

	_, err = database.DB.Exec(`
		INSERT INTO sessions (user_id, refresh_token_hash, device_info, ip_address, expires_at, last_activity)
		VALUES (?, ?, ?, ?, ?, ?)`,
		user.ID, refreshTokenHash, deviceInfo, ipAddress, expiresAt, time.Now())

	if err != nil {
		fmt.Printf("❌ [LOGIN] Session storage error: %v\n", err)
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal menyimpan session"})
		return
	}

	fmt.Println("✅ [LOGIN] Session stored successfully")

	response := models.LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         user,
		ExpiresIn:    int(middleware.AccessTokenDuration.Seconds()),
	}


	logLogin(user.ID, req.Username, r, "success", "")
	writeJSON(w, http.StatusOK, models.APIResponse{
		Success: true,
		Data:    response,
	})

	fmt.Println("✅ [LOGIN] Response sent successfully")
}

// Refresh access token using refresh token
func RefreshToken(w http.ResponseWriter, r *http.Request) {
	var req models.RefreshTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Request tidak valid"})
		return
	}

	if req.RefreshToken == "" {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Refresh token diperlukan"})
		return
	}

	// Validate refresh token
	refreshTokenHash := middleware.HashRefreshToken(req.RefreshToken)
	var session models.Session
	var user models.User

	err := database.DB.QueryRow(`
		SELECT s.id, s.user_id, s.device_info, s.ip_address, s.created_at, s.last_activity, s.expires_at,
			   u.id, u.username, u.role, u.version, u.created_at, u.updated_at
		FROM sessions s 
		JOIN users u ON s.user_id = u.id 
		WHERE s.refresh_token_hash = ? AND s.is_active = 1 AND s.expires_at > ? AND u.is_deleted = 0`,
		refreshTokenHash, time.Now(),
	).Scan(
		&session.ID, &session.UserID, &session.DeviceInfo, &session.IPAddress, &session.CreatedAt, &session.LastActivity, &session.ExpiresAt,
		&user.ID, &user.Username, &user.Role, &user.AuditFields.Version, &user.AuditFields.CreatedAt, &user.AuditFields.UpdatedAt,
	)

	if err != nil {
		writeJSON(w, http.StatusUnauthorized, models.APIResponse{Success: false, Error: "Refresh token tidak valid atau sudah kadaluarsa"})
		return
	}

	// Generate new tokens
	newAccessToken, err := middleware.GenerateAccessToken(user)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal membuat access token"})
		return
	}

	newRefreshToken, err := middleware.GenerateRefreshToken()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal membuat refresh token"})
		return
	}

	// Update session with new refresh token
	newRefreshTokenHash := middleware.HashRefreshToken(newRefreshToken)
	newExpiresAt := time.Now().Add(middleware.RefreshTokenDuration)

	_, err = database.DB.Exec(`
		UPDATE sessions SET refresh_token_hash = ?, last_activity = ?, expires_at = ?
		WHERE id = ?`,
		newRefreshTokenHash, time.Now(), newExpiresAt, session.ID)

	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal memperbarui session"})
		return
	}

	writeJSON(w, http.StatusOK, models.APIResponse{
		Success: true,
		Data: models.RefreshTokenResponse{
			AccessToken:  newAccessToken,
			RefreshToken: newRefreshToken,
			ExpiresIn:    int(middleware.AccessTokenDuration.Seconds()),
		},
	})
}

// Logout and invalidate session
func Logout(w http.ResponseWriter, r *http.Request) {
	var req models.RefreshTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Request tidak valid"})
		return
	}

	if req.RefreshToken == "" {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Refresh token diperlukan"})
		return
	}

	// Invalidate refresh token
	refreshTokenHash := middleware.HashRefreshToken(req.RefreshToken)
	database.DB.Exec("UPDATE sessions SET is_active = 0 WHERE refresh_token_hash = ?", refreshTokenHash)

	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Message: "Logout berhasil"})
}

// Get client IP address
func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header
	xff := r.Header.Get("X-Forwarded-For")
	if xff != "" {
		return strings.Split(xff, ",")[0]
	}

	// Check X-Real-IP header
	xri := r.Header.Get("X-Real-IP")
	if xri != "" {
		return xri
	}

	// Fall back to remote address
	return strings.Split(r.RemoteAddr, ":")[0]
}

func GetMe(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	writeJSON(w, http.StatusOK, models.APIResponse{
		Success: true,
		Data:    map[string]interface{}{"id": claims.UserID, "username": claims.Username, "role": claims.Role},
	})
}

// Kritis #1 — ganti password sendiri (semua role)
func ChangePassword(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	var req models.ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Request tidak valid"})
		return
	}
	if req.CurrentPassword == "" || req.NewPassword == "" {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Password lama dan baru wajib diisi"})
		return
	}
	if len(req.NewPassword) < 6 {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Password baru minimal 6 karakter"})
		return
	}
	var hash string
	database.DB.QueryRow("SELECT password_hash FROM users WHERE id=? AND is_deleted=0", claims.UserID).Scan(&hash)
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.CurrentPassword)); err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Password lama tidak sesuai"})
		return
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
	if l, err := fmt.Sscanf(limitStr, "%d", &limit); l < 1 || err != nil {
		limit = 50
	}

	rows, err := database.DB.Query(
		`SELECT id, COALESCE(user_id,0), username, ip_address, user_agent, status, reason, created_at
		 FROM login_logs ORDER BY created_at DESC LIMIT ?`, limit,
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	defer rows.Close()

	var logs []models.LoginLog
	for rows.Next() {
		var l models.LoginLog
		rows.Scan(&l.ID, &l.UserID, &l.Username, &l.IPAddress, &l.UserAgent, &l.Status, &l.Reason, &l.CreatedAt)
		logs = append(logs, l)
	}
	if logs == nil {
		logs = []models.LoginLog{}
	}
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: logs})
}

func logLogin(userID int64, username string, r *http.Request, status, reason string) {
	ip := r.RemoteAddr
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		ip = strings.Split(xff, ",")[0]
	}
	ua := r.Header.Get("User-Agent")
	if len(ua) > 200 {
		ua = ua[:200]
	}
	database.DB.Exec(
		"INSERT INTO login_logs (user_id, username, ip_address, user_agent, status, reason) VALUES (?,?,?,?,?,?)",
		userID, username, ip, ua, status, reason,
	)
}
