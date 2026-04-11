package handlers

import (
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"kasir-umkm/internal/database"
	"kasir-umkm/internal/middleware"
	"kasir-umkm/internal/models"
)

// ImportProductsCSV — Penting #9
// Expected CSV columns (header row required):
//   barcode_sku, name, category, buy_price, sell_price, stock, stock_min
func ImportProductsCSV(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	r.ParseMultipartForm(10 << 20) // 10MB

	file, _, err := r.FormFile("file")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "File tidak ditemukan"}); return
	}
	defer file.Close()

	// Strip BOM if present
	buf := make([]byte, 3)
	n, _ := file.Read(buf)
	var reader io.Reader = file
	if n == 3 && buf[0] == 0xEF && buf[1] == 0xBB && buf[2] == 0xBF {
		reader = io.MultiReader(strings.NewReader(""), file)
	} else {
		reader = io.MultiReader(strings.NewReader(string(buf[:n])), file)
	}

	cr := csv.NewReader(reader)
	cr.TrimLeadingSpace = true
	cr.LazyQuotes = true

	headers, err := cr.Read()
	if err != nil { writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "File CSV tidak valid"}); return }

	// Normalize headers
	colIdx := map[string]int{}
	for i, h := range headers {
		colIdx[strings.ToLower(strings.TrimSpace(h))] = i
	}
	required := []string{"barcode_sku", "name"}
	for _, req := range required {
		if _, ok := colIdx[req]; !ok {
			writeJSON(w, http.StatusBadRequest, models.APIResponse{
				Success: false,
				Error:   fmt.Sprintf("Kolom '%s' tidak ditemukan. Kolom wajib: barcode_sku, name", req),
			}); return
		}
	}

	result := models.ImportResult{}
	now := time.Now()

	for {
		row, err := cr.Read()
		if err == io.EOF { break }
		if err != nil { result.Failed++; result.Errors = append(result.Errors, fmt.Sprintf("Baris error: %v", err)); continue }
		result.Total++

		get := func(col string) string {
			if idx, ok := colIdx[col]; ok && idx < len(row) {
				return strings.TrimSpace(row[idx])
			}
			return ""
		}
		getF := func(col string) float64 {
			v, _ := strconv.ParseFloat(strings.ReplaceAll(get(col), ",", "."), 64)
			return v
		}
		getI := func(col string, def int) int {
			v, err := strconv.Atoi(get(col))
			if err != nil { return def }
			return v
		}

		sku  := get("barcode_sku")
		name := get("name")
		if sku == "" || name == "" || !utf8.ValidString(sku) {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("Baris %d: barcode/nama kosong atau tidak valid", result.Total)); continue
		}

		buyPrice  := getF("buy_price")
		sellPrice := getF("sell_price")
		stock     := getI("stock", 0)
		stockMin  := getI("stock_min", 5)
		if stockMin < 0 { stockMin = 5 }

		// Resolve category
		var catID interface{} = nil
		if catName := get("category"); catName != "" {
			var id int64
			err := database.DB.QueryRow("SELECT id FROM categories WHERE name=? AND is_deleted=0", catName).Scan(&id)
			if err != nil {
				// Auto-create category
				res, cerr := database.DB.Exec(
					"INSERT INTO categories (name, version, created_at, created_by, updated_at, updated_by) VALUES (?,1,?,?,?,?)",
					catName, now, claims.UserID, now, claims.UserID,
				)
				if cerr == nil { id, _ = res.LastInsertId() }
			}
			if id > 0 { catID = id }
		}

		// Upsert product
		_, err = database.DB.Exec(
			`INSERT INTO products (barcode_sku, name, category_id, buy_price, sell_price, stock, stock_min, version, created_at, created_by, updated_at, updated_by)
			 VALUES (?,?,?,?,?,?,?,1,?,?,?,?)
			 ON CONFLICT(barcode_sku) DO UPDATE SET
			   name=excluded.name, category_id=excluded.category_id,
			   buy_price=excluded.buy_price, sell_price=excluded.sell_price,
			   stock=excluded.stock, stock_min=excluded.stock_min,
			   updated_at=excluded.updated_at, updated_by=excluded.updated_by, version=version+1`,
			sku, name, catID, buyPrice, sellPrice, stock, stockMin,
			now, claims.UserID, now, claims.UserID,
		)
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("Baris %d (%s): %v", result.Total, sku, err))
		} else {
			result.Success++
		}
	}

	writeJSON(w, http.StatusOK, models.APIResponse{
		Success: true,
		Message: fmt.Sprintf("Import selesai: %d berhasil, %d gagal dari %d baris", result.Success, result.Failed, result.Total),
		Data:    result,
	})
}

// ExportProductsCSVTemplate — download template CSV untuk diisi
func ExportProductsCSVTemplate(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="template_produk.csv"`)
	w.Write([]byte{0xEF, 0xBB, 0xBF}) // BOM

	cw := csv.NewWriter(w)
	cw.Write([]string{"barcode_sku", "name", "category", "buy_price", "sell_price", "stock", "stock_min"})
	// Example rows
	cw.Write([]string{"8991234567890", "Aqua Botol 600ml", "Minuman", "2500", "3500", "100", "10"})
	cw.Write([]string{"8998866811",    "Indomie Goreng",   "Makanan", "3000", "3500", "50",  "10"})
	cw.Flush()
}
