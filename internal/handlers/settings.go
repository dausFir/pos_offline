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
		QRISImageB64:  database.GetSetting("qris_image_b64", ""),
		QRISNotes:     database.GetSetting("qris_notes", "Scan QR di atas untuk pembayaran QRIS"),
		PPNPercent:    ppn,
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

	pairs := map[string]string{
		"store_name":     req.StoreName,
		"store_address":  req.StoreAddress,
		"qris_notes":     req.QRISNotes,
		"ppn_percent":    fmt.Sprintf("%g", req.PPNPercent),
		"receipt_footer": req.ReceiptFooter,
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
