package handlers

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"kasir-umkm/internal/database"
	"kasir-umkm/internal/models"
	"kasir-umkm/internal/services"
)

// ExportTransactionsCSV exports transactions as UTF-8 CSV (Excel-compatible with BOM)
func ExportTransactionsCSV(w http.ResponseWriter, r *http.Request) {
	dateFrom := r.URL.Query().Get("date_from")
	dateTo := r.URL.Query().Get("date_to")

	query := `SELECT t.invoice_number, t.created_at, u.username,
		t.payment_method, t.total_amount, t.discount_code, t.discount_amount,
		t.payment_amount, t.change_amount,
		GROUP_CONCAT(p.name || ' x' || td.quantity, '; ') as items
		FROM transactions t
		LEFT JOIN users u ON t.user_id = u.id
		LEFT JOIN transaction_details td ON t.id = td.transaction_id
		LEFT JOIN products p ON td.product_id = p.id
		WHERE 1=1`
	args := []interface{}{}

	if dateFrom != "" {
		query += " AND DATE(t.created_at) >= ?"
		args = append(args, dateFrom)
	}
	if dateTo != "" {
		query += " AND DATE(t.created_at) <= ?"
		args = append(args, dateTo)
	}
	query += " GROUP BY t.id ORDER BY t.created_at DESC"

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	defer rows.Close()

	filename := fmt.Sprintf("transaksi_%s.csv", time.Now().Format("20060102_150405"))
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", "attachment; filename=\""+filename+"\"")

	// Write UTF-8 BOM for Excel compatibility
	w.Write([]byte{0xEF, 0xBB, 0xBF})

	cw := csv.NewWriter(w)
	// Header
	cw.Write([]string{
		"No. Invoice", "Tanggal & Waktu", "Kasir", "Metode Bayar",
		"Total Sebelum Diskon", "Kode Diskon", "Jumlah Diskon",
		"Total Setelah Diskon", "Uang Dibayar", "Kembalian", "Item Dibeli",
	})

	for rows.Next() {
		var invoice, createdAt, username, method, discCode, items string
		var total, discAmt, paid, change float64
		rows.Scan(&invoice, &createdAt, &username, &method, &total, &discCode, &discAmt, &paid, &change, &items)

		methodLabel := "Tunai"
		if method == "qris" {
			methodLabel = "QRIS"
		}

		cw.Write([]string{
			invoice,
			createdAt,
			username,
			methodLabel,
			fmt.Sprintf("%.0f", total+discAmt),
			discCode,
			fmt.Sprintf("%.0f", discAmt),
			fmt.Sprintf("%.0f", total),
			fmt.Sprintf("%.0f", paid),
			fmt.Sprintf("%.0f", change),
			items,
		})
	}
	cw.Flush()
}

// ExportProductsCSV exports product list as CSV
func ExportProductsCSV(w http.ResponseWriter, r *http.Request) {
	rows, err := database.DB.Query(
		"SELECT barcode_sku, name, buy_price, sell_price, stock, created_at FROM products ORDER BY name",
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	defer rows.Close()

	filename := fmt.Sprintf("produk_%s.csv", time.Now().Format("20060102_150405"))
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", "attachment; filename=\""+filename+"\"")
	w.Write([]byte{0xEF, 0xBB, 0xBF}) // BOM

	cw := csv.NewWriter(w)
	cw.Write([]string{"Barcode/SKU", "Nama Produk", "Harga Beli", "Harga Jual", "Stok", "Tanggal Ditambahkan"})

	for rows.Next() {
		var sku, name, createdAt string
		var buyPrice, sellPrice float64
		var stock int
		rows.Scan(&sku, &name, &buyPrice, &sellPrice, &stock, &createdAt)
		cw.Write([]string{
			sku, name,
			fmt.Sprintf("%.0f", buyPrice),
			fmt.Sprintf("%.0f", sellPrice),
			fmt.Sprintf("%d", stock),
			createdAt,
		})
	}
	cw.Flush()
}

// ExportStockMutationsCSV exports stock mutations as CSV
func ExportStockMutationsCSV(w http.ResponseWriter, r *http.Request) {
	rows, err := database.DB.Query(
		`SELECT p.barcode_sku, p.name, sm.type, sm.quantity, sm.stock_before, sm.stock_after,
		sm.note, u.username, sm.created_at
		FROM stock_mutations sm
		LEFT JOIN products p ON sm.product_id = p.id
		LEFT JOIN users u ON sm.user_id = u.id
		ORDER BY sm.created_at DESC`,
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	defer rows.Close()

	filename := fmt.Sprintf("mutasi_stok_%s.csv", time.Now().Format("20060102_150405"))
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", "attachment; filename=\""+filename+"\"")
	w.Write([]byte{0xEF, 0xBB, 0xBF})

	cw := csv.NewWriter(w)
	cw.Write([]string{"Barcode/SKU", "Produk", "Tipe", "Kuantitas", "Stok Sebelum", "Stok Sesudah", "Keterangan", "User", "Waktu"})

	typeLabel := map[string]string{"in": "Stok Masuk", "out": "Stok Keluar", "adjustment": "Penyesuaian", "sale": "Penjualan"}
	for rows.Next() {
		var sku, name, mutType, note, username, createdAt string
		var qty, before, after int
		rows.Scan(&sku, &name, &mutType, &qty, &before, &after, &note, &username, &createdAt)
		label := typeLabel[mutType]
		if label == "" {
			label = mutType
		}
		cw.Write([]string{sku, name, label, fmt.Sprintf("%d", qty), fmt.Sprintf("%d", before), fmt.Sprintf("%d", after), note, username, createdAt})
	}
	cw.Flush()
}

const maxBackupSize = 50 << 20

type backupPasswordRequest struct {
	Password string `json:"password"`
}

// BackupDatabase streams an AES-256-GCM encrypted POSBAK download. The owner
// password is never stored by the application; it is required again on restore.
func BackupDatabase(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 8<<10)
	var request backupPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Password backup wajib diisi"})
		return
	}
	if len(request.Password) < 12 {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Password backup minimal 12 karakter"})
		return
	}

	dbPath := "database.sqlite"
	// SQLite berjalan dalam WAL mode. Checkpoint memastikan perubahan di WAL
	// masuk ke file utama sebelum file tersebut diarsipkan.
	if _, err := database.DB.Exec("PRAGMA wal_checkpoint(FULL)"); err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal menyiapkan backup database"})
		return
	}
	if _, err := os.Stat(dbPath); err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "File database tidak ditemukan"})
		return
	}

	databaseData, err := os.ReadFile(dbPath)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal membaca database"})
		return
	}
	if len(databaseData) > maxBackupSize {
		writeJSON(w, http.StatusRequestEntityTooLarge, models.APIResponse{Success: false, Error: "Ukuran database melebihi batas backup 50 MB"})
		return
	}
	encryptedData, err := services.EncryptBackup(databaseData, request.Password)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal mengenkripsi backup"})
		return
	}

	filename := fmt.Sprintf("backup_kasir_%s.posbak", time.Now().Format("20060102_150405"))
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", "attachment; filename=\""+filename+"\"")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	_, _ = w.Write(encryptedData)
}

// RestoreDatabase accepts only authenticated POSBAK containers.
func RestoreDatabase(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(maxBackupSize); err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "File backup terlalu besar"})
		return
	}

	file, header, err := r.FormFile("backup")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "File backup tidak ditemukan"})
		return
	}
	defer file.Close()

	if header.Size > maxBackupSize {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "File backup terlalu besar"})
		return
	}
	if len(r.FormValue("backup_password")) < 12 {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Password backup minimal 12 karakter"})
		return
	}
	encryptedData, err := io.ReadAll(io.LimitReader(file, maxBackupSize+1))
	if err != nil || len(encryptedData) > maxBackupSize {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Gagal membaca file backup"})
		return
	}
	databaseData, err := services.DecryptBackup(encryptedData, r.FormValue("backup_password"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Backup tidak valid, telah berubah, atau password salah"})
		return
	}
	if len(databaseData) < 16 || string(databaseData[:16]) != "SQLite format 3\x00" {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Isi backup bukan database SQLite yang valid"})
		return
	}

	if err := os.WriteFile("database.sqlite.restore", databaseData, 0600); err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal menulis database hasil restore"})
		return
	}
	if err := os.Rename("database.sqlite", "database.sqlite.bak"); err != nil {
		_ = os.Remove("database.sqlite.restore")
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal menyiapkan restore database"})
		return
	}
	if err := os.Rename("database.sqlite.restore", "database.sqlite"); err != nil {
		_ = os.Rename("database.sqlite.bak", "database.sqlite")
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal mengganti database"})
		return
	}
	_ = os.Remove("database.sqlite.bak")

	writeJSON(w, http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Database berhasil dipulihkan. Harap restart aplikasi.",
	})
}
