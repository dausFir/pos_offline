package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"kasir-umkm/internal/database"
	"kasir-umkm/internal/middleware"
	"kasir-umkm/internal/models"
)

func GetSettings(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	ppn := 0.0
	if v := database.GetSetting("ppn_percent", "0"); v != "" {
		fmt.Sscanf(v, "%f", &ppn)
	}

	// Parse boolean values
	parseBool := func(key, defaultVal string) bool {
		val := database.GetSetting(key, defaultVal)
		return val == "true"
	}

	settings := models.AppSettings{
		StoreName:     database.GetSetting("store_name", "Toko Saya"),
		StoreAddress:  database.GetSetting("store_address", ""),
		LogoImageB64:  database.GetSetting("logo_image_b64", ""),
		QRISImageB64:  database.GetSetting("qris_image_b64", ""),
		QRISNotes:     database.GetSetting("qris_notes", "Scan QR di atas untuk pembayaran QRIS"),
		PPNPercent:    ppn,
		PPNMode:       database.GetSetting("ppn_mode", "exclusive"),
		ReceiptFooter: database.GetSetting("receipt_footer", "Terima kasih atas kunjungan Anda!"),

		// Payment Gateway Configuration
		PaymentGatewayEnabled: parseBool("payment_gateway_enabled", "false"),
		PaymentProvider:       database.GetSetting("payment_provider", "manual"),

		// Xendit Configuration (only show if provider is xendit)
		XenditAPIKey:    database.GetSetting("xendit_api_key", ""),
		XenditPublicKey: database.GetSetting("xendit_public_key", ""),
		XenditWebhook:   database.GetSetting("xendit_webhook", ""),

		// Midtrans Configuration (only show if provider is midtrans)
		MidtransServerKey: database.GetSetting("midtrans_server_key", ""),
		MidtransClientKey: database.GetSetting("midtrans_client_key", ""),
		MidtransSandbox:   parseBool("midtrans_sandbox", "true"),

		// E-wallet Settings
		EnableGopay:     parseBool("enable_gopay", "false"),
		EnableOvo:       parseBool("enable_ovo", "false"),
		EnableDana:      parseBool("enable_dana", "false"),
		EnableLinkAja:   parseBool("enable_linkaja", "false"),
		EnableShopeePay: parseBool("enable_shopee_pay", "false"),
	}
	// Cashiers need store/payment display settings, but must never receive
	// provider server keys from the local API response.
	if claims != nil && claims.Role == "cashier" {
		settings.XenditAPIKey = ""
		settings.MidtransServerKey = ""
	}
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: settings})
}

func UpdateSettings(w http.ResponseWriter, r *http.Request) {
	var req models.SettingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Request tidak valid"})
		return
	}

	// Validate ppn_mode
	if req.PPNMode != "" && req.PPNMode != "inclusive" && req.PPNMode != "exclusive" {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "ppn_mode harus 'inclusive' atau 'exclusive'"})
		return
	}
	// Default to exclusive if empty
	if req.PPNMode == "" {
		req.PPNMode = "exclusive"
	}

	// Validate payment provider
	if req.PaymentProvider != "" && req.PaymentProvider != "manual" && req.PaymentProvider != "xendit" && req.PaymentProvider != "midtrans" {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "payment_provider harus 'manual', 'xendit', atau 'midtrans'"})
		return
	}
	if req.PaymentProvider == "" {
		req.PaymentProvider = "manual"
	}

	// Helper function to convert bool to string
	boolToString := func(b bool) string {
		if b {
			return "true"
		}
		return "false"
	}

	pairs := map[string]string{
		"store_name":     req.StoreName,
		"store_address":  req.StoreAddress,
		"qris_notes":     req.QRISNotes,
		"ppn_percent":    fmt.Sprintf("%g", req.PPNPercent),
		"ppn_mode":       req.PPNMode,
		"receipt_footer": req.ReceiptFooter,

		// Payment Gateway Settings
		"payment_gateway_enabled": boolToString(req.PaymentGatewayEnabled),
		"payment_provider":        req.PaymentProvider,

		// Xendit Configuration
		"xendit_api_key":    req.XenditAPIKey,
		"xendit_public_key": req.XenditPublicKey,
		"xendit_webhook":    req.XenditWebhook,

		// Midtrans Configuration
		"midtrans_server_key": req.MidtransServerKey,
		"midtrans_client_key": req.MidtransClientKey,
		"midtrans_sandbox":    boolToString(req.MidtransSandbox),

		// E-wallet Settings
		"enable_gopay":      boolToString(req.EnableGopay),
		"enable_ovo":        boolToString(req.EnableOvo),
		"enable_dana":       boolToString(req.EnableDana),
		"enable_linkaja":    boolToString(req.EnableLinkAja),
		"enable_shopee_pay": boolToString(req.EnableShopeePay),
	}
	if req.LogoImageB64 != "" {
		pairs["logo_image_b64"] = req.LogoImageB64
	}
	if req.QRISImageB64 != "" {
		pairs["qris_image_b64"] = req.QRISImageB64
	}

	for k, v := range pairs {
		if err := database.SetSetting(k, v); err != nil {
			writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal simpan: " + k})
			return
		}
	}
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Message: "Pengaturan berhasil disimpan"})
}

func DeleteQRISImage(w http.ResponseWriter, r *http.Request) {
	database.SetSetting("qris_image_b64", "")
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Message: "Gambar QRIS dihapus"})
}

func DeleteLogoImage(w http.ResponseWriter, r *http.Request) {
	database.SetSetting("logo_image_b64", "")
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Message: "Logo toko dihapus"})
}
