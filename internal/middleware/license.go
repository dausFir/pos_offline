package middleware

import (
	"encoding/json"
	"net/http"
	"time"

	"kasir-umkm/internal/models"
	"kasir-umkm/internal/services"
)

// FullLicenseMiddleware protects the paid edition. It intentionally protects
// every business endpoint; only activation/status/logout remain usable when a
// license is absent or copied from another device.
func FullLicenseMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/license/status", "/api/license/activate", "/api/logout", "/api/me":
			next.ServeHTTP(w, r)
			return
		}
		if _, err := services.ValidLicense(time.Now().UTC()); err == nil {
			next.ServeHTTP(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		_ = json.NewEncoder(w).Encode(models.APIResponse{Success: false, Error: "Lisensi belum aktif atau tidak cocok dengan perangkat ini", Data: map[string]interface{}{"error_code": "LICENSE_REQUIRED"}})
	})
}
