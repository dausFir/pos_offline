package services

import "testing"

func TestParseProductCSVSeparatesValidAndInvalidRows(t *testing.T) {
	data := []byte("barcode_sku,name,buy_price,sell_price,stock,stock_min\nA1,Teh,1000,2000,4,1\n,Invalid,1,2,3,1\nA2,Kopi,-1,2,3,1\n")
	rows, errors, err := ParseProductCSV(data)
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 1 || rows[0].BarcodeSKU != "A1" {
		t.Fatalf("valid rows = %#v", rows)
	}
	if len(errors) != 2 {
		t.Fatalf("errors = %#v", errors)
	}
}

func TestParseProductCSVRequiresHeader(t *testing.T) {
	_, _, err := ParseProductCSV([]byte("name,stock\nTeh,2\n"))
	if err == nil {
		t.Fatal("expected required-header error")
	}
}

func TestChunkRows(t *testing.T) {
	rows := make([]ProductImportRow, 201)
	chunks := ChunkRows(rows, 100)
	if len(chunks) != 3 || len(chunks[0]) != 100 || len(chunks[2]) != 1 {
		t.Fatalf("unexpected chunks: %#v", chunks)
	}
}
