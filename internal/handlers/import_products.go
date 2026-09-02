package handlers

import (
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"kasir-umkm/internal/database"
	"kasir-umkm/internal/middleware"
	"kasir-umkm/internal/models"
	"kasir-umkm/internal/services"
)

type productImportTask struct {
	JobID, UserID int64
	Mode          string
	Data          []byte
}

var productImportQueue = make(chan productImportTask, 16)
var productImportWorkerOnce sync.Once

func startProductImportWorker() {
	productImportWorkerOnce.Do(func() {
		go func() {
			for task := range productImportQueue {
				processProductImport(task)
			}
		}()
	})
}

// ImportProductsCSV creates an asynchronous import job. Each chunk is committed atomically.
func ImportProductsCSV(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	if err := r.ParseMultipartForm(20 << 20); err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "File maksimal 20MB"})
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "File tidak ditemukan"})
		return
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, 20<<20+1))
	if err != nil || len(data) > 20<<20 {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "File terlalu besar"})
		return
	}
	mode := r.FormValue("stock_mode")
	if mode == "" {
		mode = "replace_stock"
	}
	if mode != "replace_stock" && mode != "add_stock" && mode != "product_only" {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "stock_mode tidak valid"})
		return
	}
	if _, _, err := services.ParseProductCSV(data); err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	result, err := database.DB.Exec("INSERT INTO import_jobs (file_name, stock_mode, status, created_by, created_at) VALUES (?,?, 'queued', ?, ?)", header.Filename, mode, claims.UserID, time.Now())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal membuat import job"})
		return
	}
	jobID, _ := result.LastInsertId()
	startProductImportWorker()
	productImportQueue <- productImportTask{JobID: jobID, UserID: claims.UserID, Mode: mode, Data: data}
	writeJSON(w, http.StatusAccepted, models.APIResponse{Success: true, Message: "Import masuk antrean", Data: map[string]interface{}{"job_id": jobID, "status": "queued"}})
}

func GetProductImportJob(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("job_id")
	var job models.ImportJob
	err := database.DB.QueryRow("SELECT id,file_name,stock_mode,total_rows,processed_rows,success_rows,failed_rows,status,error_message,created_at,COALESCE(started_at,''),COALESCE(finished_at,'') FROM import_jobs WHERE id=?", id).
		Scan(&job.ID, &job.FileName, &job.StockMode, &job.TotalRows, &job.ProcessedRows, &job.SuccessRows, &job.FailedRows, &job.Status, &job.ErrorMessage, &job.CreatedAt, &job.StartedAt, &job.FinishedAt)
	if err != nil {
		writeJSON(w, http.StatusNotFound, models.APIResponse{Success: false, Error: "Import job tidak ditemukan"})
		return
	}
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: job})
}

func GetProductImportErrors(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("job_id")
	rows, err := database.DB.Query("SELECT row_number,barcode_sku,error_message FROM import_job_errors WHERE import_job_id=? ORDER BY row_number", id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal membaca error import"})
		return
	}
	defer rows.Close()
	errors := []models.ImportJobError{}
	for rows.Next() {
		var e models.ImportJobError
		rows.Scan(&e.RowNumber, &e.BarcodeSKU, &e.ErrorMessage)
		errors = append(errors, e)
	}
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: errors})
}

func processProductImport(task productImportTask) {
	rows, parseErrors, err := services.ParseProductCSV(task.Data)
	if err != nil {
		markImportFailed(task.JobID, err.Error())
		return
	}
	now := time.Now()
	database.DB.Exec("UPDATE import_jobs SET status='processing', total_rows=?, started_at=? WHERE id=?", len(rows)+len(parseErrors), now, task.JobID)
	for _, e := range parseErrors {
		saveImportError(task.JobID, e.RowNumber, e.BarcodeSKU, e.Message, e.Raw)
	}
	processed, success, failed := len(parseErrors), 0, len(parseErrors)
	for _, chunk := range services.ChunkRows(rows, services.ProductImportChunkSize) {
		ok, count, chunkErr := processImportChunk(task, chunk)
		processed += len(chunk)
		success += count
		failed += len(chunk) - count
		if chunkErr != nil {
			for _, row := range chunk {
				saveImportError(task.JobID, row.RowNumber, row.BarcodeSKU, chunkErr.Error(), row.Raw)
			}
		}
		_ = ok
		database.DB.Exec("UPDATE import_jobs SET processed_rows=?,success_rows=?,failed_rows=? WHERE id=?", processed, success, failed, task.JobID)
	}
	status := "completed"
	if failed > 0 {
		status = "completed_with_errors"
	}
	database.DB.Exec("UPDATE import_jobs SET status=?,finished_at=? WHERE id=?", status, time.Now(), task.JobID)
}

func processImportChunk(task productImportTask, rows []services.ProductImportRow) (bool, int, error) {
	tx, err := database.DB.Begin()
	if err != nil {
		return false, 0, err
	}
	defer tx.Rollback()
	now := time.Now()
	for _, row := range rows {
		var productID int64
		var previousStock int
		err := tx.QueryRow("SELECT id,stock FROM products WHERE barcode_sku=? AND is_deleted=0", row.BarcodeSKU).Scan(&productID, &previousStock)
		exists := err == nil
		var categoryID interface{}
		if row.Category != "" {
			var id int64
			if err := tx.QueryRow("SELECT id FROM categories WHERE name=? AND is_deleted=0", row.Category).Scan(&id); err != nil {
				res, e := tx.Exec("INSERT INTO categories (name,version,created_at,created_by,updated_at,updated_by) VALUES (?,1,?,?,?,?)", row.Category, now, task.UserID, now, task.UserID)
				if e != nil {
					return false, 0, e
				}
				id, _ = res.LastInsertId()
			}
			categoryID = id
		}
		newStock := row.Stock
		if exists && task.Mode == "product_only" {
			newStock = previousStock
		}
		if exists && task.Mode == "add_stock" {
			newStock = previousStock + row.Stock
		}
		if exists {
			_, err = tx.Exec("UPDATE products SET name=?,category_id=?,buy_price=?,sell_price=?,stock=?,stock_min=?,updated_at=?,updated_by=?,version=version+1 WHERE id=?", row.Name, categoryID, row.BuyPrice, row.SellPrice, newStock, row.StockMin, now, task.UserID, productID)
		} else {
			res, e := tx.Exec("INSERT INTO products (barcode_sku,name,category_id,buy_price,sell_price,stock,stock_min,version,created_at,created_by,updated_at,updated_by) VALUES (?,?,?,?,?,?,?,1,?,?,?,?)", row.BarcodeSKU, row.Name, categoryID, row.BuyPrice, row.SellPrice, newStock, row.StockMin, now, task.UserID, now, task.UserID)
			err = e
			productID, _ = res.LastInsertId()
			previousStock = 0
		}
		if err != nil {
			return false, 0, err
		}
		if task.Mode != "product_only" && newStock != previousStock {
			kind := "adjustment"
			if newStock > previousStock {
				kind = "in"
			}
			if _, err = tx.Exec("INSERT INTO stock_mutations (product_id,type,quantity,stock_before,stock_after,note,user_id,created_at) VALUES (?,?,?,?,?,?,?,?)", productID, kind, newStock-previousStock, previousStock, newStock, fmt.Sprintf("Import job #%d", task.JobID), task.UserID, now); err != nil {
				return false, 0, err
			}
		}
	}
	if err = tx.Commit(); err != nil {
		return false, 0, err
	}
	return true, len(rows), nil
}

func saveImportError(jobID int64, rowNumber int, sku, message, raw string) {
	database.DB.Exec("INSERT INTO import_job_errors (import_job_id,row_number,barcode_sku,error_message,raw_data,created_at) VALUES (?,?,?,?,?,?)", jobID, rowNumber, sku, message, raw, time.Now())
}
func markImportFailed(jobID int64, message string) {
	database.DB.Exec("UPDATE import_jobs SET status='failed', error_message=?, finished_at=? WHERE id=?", message, time.Now(), jobID)
}

func ExportProductsCSVTemplate(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="template_produk.csv"`)
	w.Write([]byte{0xEF, 0xBB, 0xBF})
	cw := csv.NewWriter(w)
	defer cw.Flush()
	cw.Write([]string{"barcode_sku", "name", "category", "buy_price", "sell_price", "stock", "stock_min"})
	cw.Write([]string{"8991234567890", "Aqua Botol 600ml", "Minuman", "2500", "3500", "100", "10"})
}
