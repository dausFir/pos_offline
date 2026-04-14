package middleware

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"kasir-umkm/internal/database"
	"kasir-umkm/internal/models"
)

// CheckTrialLimits middleware to validate trial version limitations
func CheckTrialLimits(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip trial checks for GET requests (reading data)
		if r.Method == "GET" {
			next.ServeHTTP(w, r)
			return
		}

		// Check if this is trial version
		isTrialVersion := database.GetSetting("is_trial_version", "true") == "true"
		if !isTrialVersion {
			next.ServeHTTP(w, r)
			return
		}

		// Check if trial has expired
		if expiresStr := database.GetSetting("trial_expires_at", ""); expiresStr != "" {
			if expiresAt, err := time.Parse("2006-01-02 15:04:05", expiresStr); err == nil {
				if time.Now().After(expiresAt) {
					writeTrialError(w, "Trial period Anda telah berakhir. Silakan upgrade ke versi penuh untuk melanjutkan.")
					return
				}
			}
		}

		// Check product limits for product creation/import endpoints
		if r.URL.Path == "/api/products" && r.Method == "POST" ||
			r.URL.Path == "/api/products/import" && r.Method == "POST" {

			// Count current products
			var count int
			err := database.DB.QueryRow("SELECT COUNT(*) FROM products WHERE is_deleted = 0").Scan(&count)
			if err != nil {
				writeTrialError(w, "Error checking product limits")
				return
			}

			// Get max products limit
			maxProducts := 20
			if val := database.GetSetting("max_products", "20"); val != "" {
				if parsed, err := strconv.Atoi(val); err == nil {
					maxProducts = parsed
				}
			}

			// For import, we need to check the incoming products count
			if r.URL.Path == "/api/products/import" {
				// For simplicity, block all imports in trial
				writeTrialError(w, "Import produk tidak tersedia di versi trial. Maksimal 20 produk dapat ditambah manual.")
				return
			}

			// For single product creation
			if count >= maxProducts {
				writeTrialError(w, "Batas maksimal produk trial tercapai (20 produk). Upgrade ke versi penuh untuk menambah lebih banyak produk.")
				return
			}
		}

		next.ServeHTTP(w, r)
	})
}

// CheckTrialExpiry middleware to block all protected endpoints when trial expired
func CheckTrialExpiry(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check if this is trial version
		isTrialVersion := database.GetSetting("is_trial_version", "true") == "true"
		if !isTrialVersion {
			next.ServeHTTP(w, r)
			return
		}

		// Check if trial has expired
		if expiresStr := database.GetSetting("trial_expires_at", ""); expiresStr != "" {
			if expiresAt, err := time.Parse("2006-01-02 15:04:05", expiresStr); err == nil {
				if time.Now().After(expiresAt) {
					// Allow only settings and license endpoints
					allowedPaths := []string{
						"/api/settings",
						"/api/license/activate",
						"/api/trial/contact",
						"/api/me",
						"/api/logout",
					}

					for _, path := range allowedPaths {
						if r.URL.Path == path {
							next.ServeHTTP(w, r)
							return
						}
					}

					writeTrialError(w, "Trial period Anda telah berakhir. Semua fitur terkunci. Silakan aktivasi license untuk melanjutkan.")
					return
				}
			}
		}

		next.ServeHTTP(w, r)
	})
}

// CheckTrialForExport middleware specifically for export endpoints
func CheckTrialForExport(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check if this is trial version
		isTrialVersion := database.GetSetting("is_trial_version", "true") == "true"
		if !isTrialVersion {
			next.ServeHTTP(w, r)
			return
		}

		// Block all export functionality in trial
		writeTrialError(w, "Fitur export tidak tersedia di versi trial. Upgrade ke versi penuh untuk mengakses fitur export.")
	})
}

// CheckTrialForBackup middleware specifically for backup/restore endpoints
func CheckTrialForBackup(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check if this is trial version
		isTrialVersion := database.GetSetting("is_trial_version", "true") == "true"
		if !isTrialVersion {
			next.ServeHTTP(w, r)
			return
		}

		// Block backup/restore functionality in trial
		writeTrialError(w, "Fitur backup/restore database tidak tersedia di versi trial. Upgrade ke versi penuh untuk mengamankan data Anda.")
	})
}

// CheckTrialForAdvancedReports middleware for advanced reporting features
func CheckTrialForAdvancedReports(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check if this is trial version
		isTrialVersion := database.GetSetting("is_trial_version", "true") == "true"
		if !isTrialVersion {
			next.ServeHTTP(w, r)
			return
		}

		// Check the specific report path
		path := r.URL.Path
		if path == "/api/reports/profit" {
			// Allow basic profit report but with limited data
			// Check if requesting detailed/advanced features via query params
			if r.URL.Query().Get("category_breakdown") == "1" ||
				r.URL.Query().Get("period") == "yearly" ||
				r.URL.Query().Get("export") == "1" {
				writeTrialError(w, "Laporan detail dan breakdown kategori tidak tersedia di versi trial. Upgrade untuk akses laporan lengkap.")
				return
			}
		}

		// Block advanced reports completely
		if path == "/api/reports/shift" {
			writeTrialError(w, "Laporan shift tidak tersedia di versi trial. Upgrade untuk akses semua fitur laporan.")
			return
		}

		next.ServeHTTP(w, r)
	})
}

func writeTrialError(w http.ResponseWriter, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusForbidden)
	response := models.APIResponse{
		Success: false,
		Error:   message,
		Data: map[string]interface{}{
			"is_trial_limit": true,
		},
	}
	json.NewEncoder(w).Encode(response)
}
