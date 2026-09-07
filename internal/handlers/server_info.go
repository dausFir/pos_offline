package handlers

import (
 "net/http"
 "kasir-umkm/internal/models"
 "kasir-umkm/internal/services"
)

func GetServerInfo(w http.ResponseWriter, r *http.Request) { host,port,lan:=services.ServerInfo();writeJSON(w,http.StatusOK,models.APIResponse{Success:true,Data:map[string]string{"host":host,"port":port,"lan_url":lan}}) }
