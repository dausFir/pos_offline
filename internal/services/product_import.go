package services

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"io"
	"strconv"
	"strings"
	"unicode/utf8"
)

const ProductImportChunkSize = 100

type ProductImportRow struct {
	RowNumber  int
	BarcodeSKU string
	Name       string
	Category   string
	BuyPrice   float64
	SellPrice  float64
	Stock      int
	StockMin   int
	Raw        string
}

type ProductImportError struct {
	RowNumber  int
	BarcodeSKU string
	Message    string
	Raw        string
}

func ParseProductCSV(data []byte) ([]ProductImportRow, []ProductImportError, error) {
	data = bytes.TrimPrefix(data, []byte{0xEF, 0xBB, 0xBF})
	reader := csv.NewReader(bytes.NewReader(data))
	reader.TrimLeadingSpace, reader.LazyQuotes = true, true
	headers, err := reader.Read()
	if err != nil {
		return nil, nil, fmt.Errorf("file CSV tidak valid: %w", err)
	}
	cols := map[string]int{}
	for i, h := range headers {
		cols[strings.ToLower(strings.TrimSpace(h))] = i
	}
	for _, required := range []string{"barcode_sku", "name"} {
		if _, ok := cols[required]; !ok {
			return nil, nil, fmt.Errorf("kolom '%s' tidak ditemukan", required)
		}
	}
	get := func(row []string, name string) string {
		i, ok := cols[name]
		if !ok || i >= len(row) {
			return ""
		}
		return strings.TrimSpace(row[i])
	}
	var valid []ProductImportRow
	var invalid []ProductImportError
	for rowNo := 2; ; rowNo++ {
		row, readErr := reader.Read()
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			invalid = append(invalid, ProductImportError{RowNumber: rowNo, Message: readErr.Error()})
			continue
		}
		raw := strings.Join(row, ",")
		sku, name := get(row, "barcode_sku"), get(row, "name")
		if sku == "" || name == "" || !utf8.ValidString(sku) {
			invalid = append(invalid, ProductImportError{RowNumber: rowNo, BarcodeSKU: sku, Message: "barcode_sku dan name wajib diisi", Raw: raw})
			continue
		}
		parseFloat := func(column string) (float64, error) {
			v := get(row, column)
			if v == "" {
				return 0, nil
			}
			return strconv.ParseFloat(strings.ReplaceAll(v, ",", "."), 64)
		}
		parseInt := func(column string, fallback int) (int, error) {
			v := get(row, column)
			if v == "" {
				return fallback, nil
			}
			return strconv.Atoi(v)
		}
		buy, e1 := parseFloat("buy_price")
		sell, e2 := parseFloat("sell_price")
		stock, e3 := parseInt("stock", 0)
		stockMin, e4 := parseInt("stock_min", 5)
		if e1 != nil || e2 != nil || e3 != nil || e4 != nil || buy < 0 || sell < 0 || stock < 0 || stockMin < 0 {
			invalid = append(invalid, ProductImportError{RowNumber: rowNo, BarcodeSKU: sku, Message: "harga dan stok harus berupa angka tidak negatif", Raw: raw})
			continue
		}
		valid = append(valid, ProductImportRow{rowNo, sku, name, get(row, "category"), buy, sell, stock, stockMin, raw})
	}
	return valid, invalid, nil
}

func ChunkRows(rows []ProductImportRow, size int) [][]ProductImportRow {
	if size <= 0 {
		size = ProductImportChunkSize
	}
	chunks := make([][]ProductImportRow, 0, (len(rows)+size-1)/size)
	for start := 0; start < len(rows); start += size {
		end := start + size
		if end > len(rows) {
			end = len(rows)
		}
		chunks = append(chunks, rows[start:end])
	}
	return chunks
}
