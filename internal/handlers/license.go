package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"kasir-umkm/internal/models"
	"kasir-umkm/internal/services"
)

type licenseActivationRequest struct {
	Token string `json:"token"`
}

func GetLicenseStatus(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: services.CurrentTrialStatus(time.Now().UTC())})
}

func ActivateLicense(w http.ResponseWriter, r *http.Request) {
	var req licenseActivationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Token == "" {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Token lisensi wajib diisi"})
		return
	}
	claims, err := services.ActivateLicense(req.Token, time.Now().UTC())
	if err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Lisensi tidak valid untuk instalasi ini"})
		return
	}
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Message: "Lisensi berhasil diaktifkan", Data: map[string]string{"license_id": claims.LicenseID}})
}
