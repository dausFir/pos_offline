package middleware

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"kasir-umkm/internal/models"
	"kasir-umkm/internal/services"
)

// TrialMiddleware is installed before all protected API handlers. UI hiding is
// not a control: every restricted route is enforced here on the server.
func TrialMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/license/status" || r.URL.Path == "/api/license/activate" {
			next.ServeHTTP(w, r)
			return
		}
		status := services.CurrentTrialStatus(time.Now().UTC())
		if status.Expired {
			writeTrialError(w, "TRIAL_EXPIRED", "Masa trial telah berakhir. Aktivasi lisensi untuk melanjutkan.")
			return
		}
		if status.Licensed {
			next.ServeHTTP(w, r)
			return
		}
		if isBlockedTrialFeature(r) {
			writeTrialError(w, "TRIAL_FEATURE_LOCKED", "Fitur ini tidak tersedia pada edisi trial.")
			return
		}
		if r.Method == http.MethodPost && r.URL.Path == "/api/products" {
			reached, err := services.ProductLimitReached()
			if err != nil {
				writeTrialError(w, "TRIAL_CHECK_FAILED", "Gagal memeriksa batas produk trial.")
				return
			}
			if reached {
				writeTrialError(w, "TRIAL_PRODUCT_LIMIT", "Batas 20 produk pada edisi trial telah tercapai.")
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func isBlockedTrialFeature(r *http.Request) bool {
	p := r.URL.Path
	return strings.HasPrefix(p, "/api/export/") ||
		p == "/api/backup" || p == "/api/restore" ||
		strings.HasPrefix(p, "/api/import/products") ||
		p == "/api/reports/shift"
}

func writeTrialError(w http.ResponseWriter, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusForbidden)
	_ = json.NewEncoder(w).Encode(models.APIResponse{Success: false, Error: message, Data: map[string]interface{}{
		"error_code":     code,
		"is_trial_limit": true,
	}})
}
