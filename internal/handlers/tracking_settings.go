package handlers

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strings"

	"kasir-umkm/internal/database"
	"kasir-umkm/internal/models"
)

type trackingSettingsRequest struct { URL string `json:"url"` }

func GetTrackingSettings(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, models.APIResponse{Success:true, Data:map[string]string{"url":database.GetSetting("tracking_sync_url", "")}})
}

func UpdateTrackingSettings(w http.ResponseWriter, r *http.Request) {
	var req trackingSettingsRequest
	if err:=json.NewDecoder(r.Body).Decode(&req);err!=nil { writeJSON(w,400,models.APIResponse{Success:false,Error:"Request tidak valid"});return }
	req.URL=strings.TrimSpace(req.URL)
	if req.URL!="" {
		u,err:=url.ParseRequestURI(req.URL)
		if err!=nil || u.Host=="" || (u.Scheme!="https" && u.Scheme!="http") || u.User!=nil { writeJSON(w,400,models.APIResponse{Success:false,Error:"URL tracking harus http(s) yang valid tanpa kredensial"});return }
		if !strings.HasSuffix(u.Path,"/api/sync") { writeJSON(w,400,models.APIResponse{Success:false,Error:"URL tracking harus mengarah ke endpoint /api/sync"});return }
	}
	if err:=database.SetSetting("tracking_sync_url",req.URL);err!=nil { writeJSON(w,500,models.APIResponse{Success:false,Error:"Gagal menyimpan URL tracking"});return }
	writeJSON(w,200,models.APIResponse{Success:true,Message:"URL tracking disimpan"})
}
