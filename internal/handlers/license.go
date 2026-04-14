package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"kasir-umkm/internal/database"
	"kasir-umkm/internal/models"
)

// ActivateLicense handles license key activation to convert trial to full version
func ActivateLicense(w http.ResponseWriter, r *http.Request) {
	var req models.LicenseActivationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Request tidak valid"})
		return
	}

	if req.LicenseKey == "" {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "License key wajib diisi"})
		return
	}

	// Validate license key (this would typically call external validation service)
	isValid := validateLicenseKey(req.LicenseKey)
	if !isValid {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "License key tidak valid atau sudah digunakan"})
		return
	}

	// Deactivate trial and activate full version
	pairs := map[string]string{
		"is_trial_version": "false",
		"license_key":      req.LicenseKey,
		"store_name":       req.StoreName,
		"store_email":      req.Email,
		"store_phone":      req.Phone,
		"activated_at":     time.Now().Format("2006-01-02 15:04:05"),
	}

	for k, v := range pairs {
		if err := database.SetSetting(k, v); err != nil {
			writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal mengaktifkan license"})
			return
		}
	}

	writeJSON(w, http.StatusOK, models.APIResponse{
		Success: true,
		Message: "License berhasil diaktifkan! Selamat menikmati versi penuh.",
		Data: map[string]interface{}{
			"is_trial_version": false,
			"license_key":      req.LicenseKey,
		},
	})
}

// SubmitTrialContact handles trial user contact form for lead generation
func SubmitTrialContact(w http.ResponseWriter, r *http.Request) {
	var req models.TrialContactRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Request tidak valid"})
		return
	}

	if req.Name == "" || req.Email == "" {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Nama dan email wajib diisi"})
		return
	}

	// Store contact request in database for follow-up
	query := `
		INSERT INTO trial_contacts (name, email, phone, message, interest, submitted_at) 
		VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
	`

	_, err := database.DB.Exec(query, req.Name, req.Email, req.Phone, req.Message, req.Interest)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal menyimpan kontak"})
		return
	}

	// In production, you would also send email notification or integrate with CRM
	// sendContactNotification(req)

	writeJSON(w, http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Terima kasih! Tim kami akan menghubungi Anda segera untuk demo dan penawaran khusus.",
	})
}

// GetTrialUsageStats returns trial usage analytics
func GetTrialUsageStats(w http.ResponseWriter, r *http.Request) {
	// Count products created
	var productsCreated int
	database.DB.QueryRow("SELECT COUNT(*) FROM products WHERE is_deleted = 0").Scan(&productsCreated)

	// Count transactions
	var transactionsCount int
	var totalRevenue float64
	database.DB.QueryRow("SELECT COUNT(*), COALESCE(SUM(total_amount), 0) FROM transactions WHERE status = 'completed'").Scan(&transactionsCount, &totalRevenue)

	// Calculate days used
	trialStartStr := database.GetSetting("trial_start_date", "")
	var daysUsed int
	if trialStartStr != "" {
		if startDate, err := time.Parse("2006-01-02 15:04:05", trialStartStr); err == nil {
			daysUsed = int(time.Since(startDate).Hours() / 24)
		}
	}

	// Feature usage tracking (basic implementation)
	featureUsage := map[string]int{
		"pos_transactions": transactionsCount,
		"products_added":   productsCreated,
		"login_sessions":   getLoginSessionsCount(),
	}

	stats := models.TrialUsageStats{
		ProductsCreated:   productsCreated,
		TransactionsCount: transactionsCount,
		TotalRevenue:      totalRevenue,
		DaysUsed:          daysUsed,
		FeatureUsage:      featureUsage,
	}

	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: stats})
}

// Helper function to validate license key (placeholder)
func validateLicenseKey(key string) bool {
	// In production, this would validate against license server
	// For demo purposes, accept any key that starts with "KASIR-"
	if len(key) >= 10 && key[:6] == "KASIR-" {
		return true
	}
	return false
}

// Helper function to get login sessions count
func getLoginSessionsCount() int {
	var count int
	database.DB.QueryRow("SELECT COUNT(*) FROM login_logs WHERE status = 'success' AND DATE(created_at) >= DATE(?)").Scan(database.GetSetting("trial_start_date", ""))
	return count
}
