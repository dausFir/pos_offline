package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"kasir-umkm/internal/database"
	"kasir-umkm/internal/models"
)

func GetSettings(w http.ResponseWriter, r *http.Request) {
	ppn := 0.0
	if v := database.GetSetting("ppn_percent", "0"); v != "" {
		fmt.Sscanf(v, "%f", &ppn)
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

	pairs := map[string]string{
		"store_name":     req.StoreName,
		"store_address":  req.StoreAddress,
		"qris_notes":     req.QRISNotes,
		"ppn_percent":    fmt.Sprintf("%g", req.PPNPercent),
		"ppn_mode":       req.PPNMode,
		"receipt_footer": req.ReceiptFooter,
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
