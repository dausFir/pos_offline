package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"strconv"
	"time"

	"kasir-umkm/internal/database"
	"kasir-umkm/internal/middleware"
	"kasir-umkm/internal/models"
	"kasir-umkm/internal/services"
)

type shiftRequest struct {
	Cash float64 `json:"cash"`
	Note string  `json:"note"`
}

func OpenShift(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	var req shiftRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Cash < 0 {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Kas awal harus bernilai nol atau lebih"})
		return
	}
	result, err := database.DB.Exec("INSERT INTO cash_shifts (user_id,opening_cash,expected_cash,open_note,status,opened_at) VALUES (?,?,?,?, 'open',?)", claims.UserID, req.Cash, req.Cash, req.Note, time.Now())
	if err != nil {
		writeJSON(w, http.StatusConflict, models.APIResponse{Success: false, Error: "Masih ada shift aktif untuk kasir ini"})
		return
	}
	id, _ := result.LastInsertId()
	writeJSON(w, http.StatusCreated, models.APIResponse{Success: true, Message: "Shift dibuka", Data: map[string]interface{}{"id": id, "opening_cash": req.Cash}})
}

func GetMyShift(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	var item struct {
		ID          int64   `json:"id"`
		OpeningCash float64 `json:"opening_cash"`
		OpenedAt    string  `json:"opened_at"`
		OpenNote    string  `json:"open_note"`
	}
	err := database.DB.QueryRow("SELECT id,opening_cash,opened_at,open_note FROM cash_shifts WHERE user_id=? AND status='open'", claims.UserID).Scan(&item.ID, &item.OpeningCash, &item.OpenedAt, &item.OpenNote)
	if err != nil {
		writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: nil})
		return
	}
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: item})
}

func CloseShift(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	var req shiftRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Cash < 0 {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Kas fisik harus bernilai nol atau lebih"})
		return
	}
	var id int64
	var opening float64
	var openedAt time.Time
	if err := database.DB.QueryRow("SELECT id,opening_cash,opened_at FROM cash_shifts WHERE user_id=? AND status='open'", claims.UserID).Scan(&id, &opening, &openedAt); err != nil {
		writeJSON(w, http.StatusNotFound, models.APIResponse{Success: false, Error: "Tidak ada shift aktif"})
		return
	}
	var cashSales float64
	_ = database.DB.QueryRow("SELECT COALESCE(SUM(cash_amount),0) FROM transactions WHERE user_id=? AND status='completed' AND is_deleted=0 AND created_at>=?", claims.UserID, openedAt).Scan(&cashSales)
	expected, diff := services.ReconcileCash(opening, cashSales, req.Cash)
	_, err := database.DB.Exec("UPDATE cash_shifts SET expected_cash=?,counted_cash=?,difference=?,close_note=?,status='closed',closed_at=?,closed_by=? WHERE id=? AND status='open'", expected, req.Cash, diff, req.Note, time.Now(), claims.UserID, id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal menutup shift"})
		return
	}
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Message: "Shift ditutup", Data: map[string]interface{}{"id": id, "expected_cash": expected, "counted_cash": req.Cash, "difference": diff, "cash_sales": cashSales}})
}

func GetCashShifts(w http.ResponseWriter, r *http.Request) {
	rows, err := database.DB.Query(`SELECT s.id,u.username,s.opening_cash,s.expected_cash,COALESCE(s.counted_cash,0),COALESCE(s.difference,0),s.status,s.opened_at,COALESCE(s.closed_at,''),s.open_note,s.close_note FROM cash_shifts s JOIN users u ON u.id=s.user_id ORDER BY s.opened_at DESC LIMIT 100`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal membaca shift"})
		return
	}
	defer rows.Close()
	list := []map[string]interface{}{}
	for rows.Next() {
		var id int64
		var username, status, opened, closed, openNote, closeNote string
		var opening, expected, counted, diff float64
		_ = rows.Scan(&id, &username, &opening, &expected, &counted, &diff, &status, &opened, &closed, &openNote, &closeNote)
		list = append(list, map[string]interface{}{"id": id, "username": username, "opening_cash": opening, "expected_cash": expected, "counted_cash": counted, "difference": diff, "status": status, "opened_at": opened, "closed_at": closed, "open_note": openNote, "close_note": closeNote})
	}
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: list})
}

func GetAuditEvents(w http.ResponseWriter, r *http.Request) {
	limit := 100
	if v, e := strconv.Atoi(r.URL.Query().Get("limit")); e == nil && v > 0 && v <= 500 {
		limit = v
	}
	rows, err := database.DB.Query(`SELECT id,COALESCE(user_id,0),username,action,resource,detail,event_hash,created_at FROM audit_events ORDER BY id DESC LIMIT ?`, limit)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal membaca audit log"})
		return
	}
	defer rows.Close()
	list := []map[string]interface{}{}
	for rows.Next() {
		var id, userID int64
		var username, action, resource, detail, hash, created string
		_ = rows.Scan(&id, &userID, &username, &action, &resource, &detail, &hash, &created)
		list = append(list, map[string]interface{}{"id": id, "user_id": userID, "username": username, "action": action, "resource": resource, "detail": detail, "event_hash": hash, "created_at": created})
	}
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: list})
}

func GetHealth(w http.ResponseWriter, r *http.Request) {
	if err := database.DB.Ping(); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, models.APIResponse{Success: false, Error: "database tidak tersedia"})
		return
	}
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: map[string]interface{}{"status": "healthy", "version": database.AppVersion, "timestamp": time.Now()}})
}

func GetDiagnostics(w http.ResponseWriter, r *http.Request) {
	var integrity string
	err := database.DB.QueryRow("PRAGMA integrity_check").Scan(&integrity)
	badAudit, auditErr := database.VerifyAuditChain()
	info, _ := os.Stat("database.sqlite")
	size := int64(0)
	if info != nil {
		size = info.Size()
	}
	data := map[string]interface{}{"database_integrity": integrity, "audit_chain_valid": badAudit == 0 && auditErr == nil, "audit_bad_event_id": badAudit, "database_size_bytes": size, "last_auto_backup_at": database.GetSetting("last_auto_backup_at", "")}
	if err != nil {
		data["database_integrity"] = "error"
	}
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: data})
}
