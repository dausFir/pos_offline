package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"kasir-umkm/internal/database"
	"kasir-umkm/internal/middleware"
	"kasir-umkm/internal/models"
	"kasir-umkm/internal/services"

	"github.com/gorilla/mux"
)

func Checkout(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)

	var req models.CheckoutRequestV3
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		fmt.Printf("[ERROR] Decode request body: %v\n", err)
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Request tidak valid"})
		return
	}
	if len(req.Items) == 0 && req.ServiceOrderID <= 0 {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Keranjang belanja kosong"})
		return
	}
	if req.OnCredit {
		if req.CustomerID <= 0 {
			writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Pelanggan wajib dipilih untuk transaksi kredit"})
			return
		}
		req.PaymentMethod = "credit"
	}
	validMethod := map[string]bool{
		"cash": true, "qris": true, "split": true,
		"gopay": true, "ovo": true, "dana": true, "linkaja": true, "shopeepay": true,
		"credit": true,
	}
	if !validMethod[req.PaymentMethod] {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Metode pembayaran tidak valid"})
		return
	}

	tx, err := database.DB.Begin()
	if err != nil {
		fmt.Printf("[ERROR] Begin transaction: %v\n", err)
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal memulai transaksi"})
		return
	}
	defer tx.Rollback() // Always rollback, akan diabaikan jika sudah commit
	if !isPeriodOpen(tx, time.Now()) {
		writeJSON(w, http.StatusConflict, models.APIResponse{Success:false, Error:"Periode akuntansi bulan ini sudah ditutup"})
		return
	}

	type itemDetail struct {
		product                       models.Product
		qty                           int
		unitPrice, subtotal, buyPrice float64
		lineDiscount, netSubtotal     float64
		catName                       string
		itemType                      string
	}
	var details []itemDetail
	var subtotalBeforeDiscount float64

	if req.ServiceOrderID > 0 {
		var serviceProductID int64; var customerID, invoiceID sql.NullInt64
		if err:=tx.QueryRow("SELECT service_product_id,customer_id,invoice_id FROM service_orders WHERE id=?",req.ServiceOrderID).Scan(&serviceProductID,&customerID,&invoiceID);err!=nil||serviceProductID==0 { writeJSON(w,404,models.APIResponse{Success:false,Error:"Order servis tidak ditemukan"});return }
		if invoiceID.Valid { writeJSON(w,400,models.APIResponse{Success:false,Error:"Order servis sudah ditagihkan"});return }
		req.Items=[]models.CheckoutItem{{ProductID:serviceProductID,Quantity:1}}
		rows,err:=tx.Query("SELECT product_id,quantity FROM service_parts WHERE service_order_id=?",req.ServiceOrderID);if err!=nil{writeJSON(w,500,models.APIResponse{Success:false,Error:"Gagal membaca sparepart"});return};for rows.Next(){var part models.CheckoutItem;rows.Scan(&part.ProductID,&part.Quantity);req.Items=append(req.Items,part)};rows.Close()
		if req.CustomerID==0&&customerID.Valid { req.CustomerID=customerID.Int64 }
	}

	itemsByProduct := make(map[int64]int, len(req.Items))
	for _, item := range req.Items {
		if item.Quantity <= 0 {
			writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Kuantitas harus > 0"})
			return
		}
		itemsByProduct[item.ProductID] += item.Quantity
	}

	for productID, quantity := range itemsByProduct {
		var p models.Product
		var catName string
		scanErr := tx.QueryRow(
			`SELECT p.id, p.barcode_sku, p.name, COALESCE(c.name,''), p.buy_price, p.sell_price, p.stock, p.item_type
			 FROM products p LEFT JOIN categories c ON p.category_id=c.id
			 WHERE p.id=? AND p.is_deleted=0`, productID,
		).Scan(&p.ID, &p.BarcodeSKU, &p.Name, &catName, &p.BuyPrice, &p.SellPrice, &p.Stock, &p.ItemType)
		if scanErr != nil {
			writeJSON(w, http.StatusNotFound, models.APIResponse{Success: false, Error: fmt.Sprintf("Produk ID %d tidak ditemukan", productID)})
			return
		}
		if p.ItemType == "physical" && p.Stock < quantity {
			writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: fmt.Sprintf("Stok %s tidak cukup (tersedia: %d)", p.Name, p.Stock)})
			return
		}
		unitPrice := p.SellPrice
		// Harga tier dihitung ulang di server; nilai dari browser tidak dipercaya.
		var tierPrice float64
		if err := tx.QueryRow("SELECT price FROM price_tiers WHERE product_id=? AND min_qty<=? AND price<? ORDER BY min_qty DESC LIMIT 1", p.ID, quantity, p.SellPrice).Scan(&tierPrice); err == nil {
			unitPrice = tierPrice
		}
		sub := unitPrice * float64(quantity)
		subtotalBeforeDiscount += sub
		details = append(details, itemDetail{product: p, qty: quantity, unitPrice: unitPrice, subtotal: sub, buyPrice: p.BuyPrice, catName: catName, itemType:p.ItemType})
	}

	// Validate discount
	var discountAmount float64
	discountCode := req.DiscountCode
	if discountCode != "" {
		var dtype string
		var dvalue, dmin float64
		var isActive int
		err2 := tx.QueryRow(
			"SELECT type, value, min_purchase, is_active FROM discounts WHERE code=? COLLATE NOCASE AND is_deleted=0",
			discountCode,
		).Scan(&dtype, &dvalue, &dmin, &isActive)
		if err2 != nil || isActive != 1 {
			discountCode = ""
		} else if subtotalBeforeDiscount >= dmin {
			if dtype == "percent" {
				discountAmount = subtotalBeforeDiscount * dvalue / 100
			} else {
				discountAmount = dvalue
				if discountAmount > subtotalBeforeDiscount {
					discountAmount = subtotalBeforeDiscount
				}
			}
		}
	}
	subtotalAfterDiscount := subtotalBeforeDiscount - discountAmount
	lineSubtotals := make([]float64, len(details))
	for i := range details { lineSubtotals[i] = details[i].subtotal }
	lineDiscounts := services.AllocateDiscount(lineSubtotals, discountAmount)
	for i := range details {
		details[i].lineDiscount = lineDiscounts[i]
		details[i].netSubtotal = details[i].subtotal - details[i].lineDiscount
	}

	// PPN / Tax calculation with support for inclusive/exclusive mode
	ppnPct := 0.0
	if v := database.GetSetting("ppn_percent", "0"); v != "" {
		fmt.Sscanf(v, "%f", &ppnPct)
	}

	ppnMode := database.GetSetting("ppn_mode", "exclusive") // default to exclusive
	ppnAmount := 0.0
	totalAmount := subtotalAfterDiscount

	if ppnPct > 0 {
		if ppnMode == "inclusive" {
			// Tax inclusive: PPN sudah termasuk dalam harga
			// ppnAmount = subtotalAfterDiscount * ppnPct / (100 + ppnPct)
			ppnAmount = subtotalAfterDiscount * ppnPct / (100 + ppnPct)
			// totalAmount tetap sama karena PPN sudah included
			totalAmount = subtotalAfterDiscount
		} else {
			// Tax exclusive: PPN ditambahkan ke harga
			ppnAmount = subtotalAfterDiscount * ppnPct / 100
			totalAmount = subtotalAfterDiscount + ppnAmount
		}
	}
	// Deposits are a customer advance, not a discount.  The final invoice keeps
	// its full value while only the outstanding amount is collected now.
	serviceDepositCredit := 0.0
	if req.ServiceOrderID > 0 {
		if err := tx.QueryRow(`SELECT COALESCE(SUM(CASE WHEN direction='in' AND type='service_deposit' THEN amount WHEN direction='out' AND type='refund' THEN -amount ELSE 0 END),0) FROM payment_ledger WHERE service_order_id=?`, req.ServiceOrderID).Scan(&serviceDepositCredit); err != nil {
			writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success:false,Error:"Gagal menghitung DP servis"}); return
		}
		if serviceDepositCredit > totalAmount { serviceDepositCredit = totalAmount }
	}
	paymentDue := totalAmount - serviceDepositCredit

	// Kritis #6: Split payment validation + E-wallet support
	cashAmt, qrisAmt := req.CashAmount, req.QRISAmount
	ewalletMethods := map[string]bool{
		"gopay": true, "ovo": true, "dana": true, "linkaja": true, "shopeepay": true,
	}

	switch req.PaymentMethod {
	case "credit":
		cashAmt, qrisAmt = 0, 0
		req.EwalletAmount, req.EwalletProvider = 0, ""
		req.PaymentAmount = 0
	case "cash":
		cashAmt = req.PaymentAmount
		qrisAmt = 0
		if req.PaymentAmount < paymentDue {
			writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: fmt.Sprintf("Pembayaran kurang. Sisa tagihan: Rp %.0f", paymentDue)})
			return
		}
	case "qris":
		qrisAmt = paymentDue
		cashAmt = 0
		req.PaymentAmount = paymentDue
	case "split":
		if cashAmt < 0 || qrisAmt < 0 {
			writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Nominal split tidak boleh negatif"})
			return
		}
		total := cashAmt + qrisAmt
		if total != paymentDue {
			writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: fmt.Sprintf("Total split harus sama dengan sisa tagihan (Rp %.0f)", paymentDue)})
			return
		}
		req.PaymentAmount = total
	default:
		// Handle e-wallet payments
		if ewalletMethods[req.PaymentMethod] {
			req.EwalletAmount = paymentDue
			req.EwalletProvider = req.PaymentMethod
			req.PaymentAmount = paymentDue
			cashAmt = 0
			qrisAmt = 0
		}
	}
	changeAmount := req.PaymentAmount - paymentDue
	// Only cash payments get change
	if req.PaymentMethod != "cash" {
		changeAmount = 0
	}

	now := time.Now()
	invoice, err := database.GenerateInvoiceNumberWithTx(tx)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal generate invoice number"})
		return
	}

	// Penting #5: resolve customer nullable
	var custID interface{} = nil
	if req.CustomerID > 0 {
		custID = req.CustomerID
	}
	onCreditVal := 0
	if req.OnCredit {
		onCreditVal = 1
		var customerExists int
		if err := tx.QueryRow("SELECT COUNT(*) FROM customers WHERE id=? AND is_deleted=0", req.CustomerID).Scan(&customerExists); err != nil || customerExists != 1 {
			writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Pelanggan tidak ditemukan"})
			return
		}
	}

	result, err := tx.Exec(
		`INSERT INTO transactions
		(invoice_number,user_id,customer_id,total_amount,payment_amount,change_amount,payment_method,cash_amount,qris_amount,ewallet_amount,ewallet_provider,
		 discount_code,discount_amount,ppn_amount,on_credit,status,version,created_at,created_by,updated_at,updated_by)
		VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		invoice, claims.UserID, custID, totalAmount, req.PaymentAmount, changeAmount, req.PaymentMethod, cashAmt, qrisAmt, req.EwalletAmount, req.EwalletProvider,
		discountCode, discountAmount, ppnAmount, onCreditVal, "completed", 1, now, claims.UserID, now, claims.UserID,
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal simpan transaksi"})
		return
	}
	txID, _ := result.LastInsertId()

	var txDetails []models.TransactionDetail
	for _, d := range details {
		_, err = tx.Exec(
			`INSERT INTO transaction_details (transaction_id,product_id,product_name,category_name,quantity,unit_price,buy_price,subtotal,discount_amount,net_subtotal,created_at)
			 VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
			txID, d.product.ID, d.product.Name, d.catName, d.qty, d.unitPrice, d.buyPrice, d.subtotal, d.lineDiscount, d.netSubtotal, now,
		)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal simpan detail"})
			return
		}
		if d.itemType != "physical" {
			txDetails = append(txDetails, models.TransactionDetail{TransactionID:txID, ProductID:d.product.ID, ProductName:d.product.Name, CategoryName:d.catName, Quantity:d.qty, UnitPrice:d.unitPrice, BuyPrice:d.buyPrice, Subtotal:d.subtotal, DiscountAmount:d.lineDiscount, NetSubtotal:d.netSubtotal, Profit:d.netSubtotal-d.buyPrice*float64(d.qty)})
			continue
		}

		stockBefore := d.product.Stock
		stockResult, err := tx.Exec("UPDATE products SET stock=stock-?,updated_at=?,updated_by=?,version=version+1 WHERE id=? AND stock>=? AND is_deleted=0",
			d.qty, now, claims.UserID, d.product.ID, d.qty)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal update stok"})
			return
		}
		if updated, _ := stockResult.RowsAffected(); updated != 1 {
			writeJSON(w, http.StatusConflict, models.APIResponse{Success: false, Error: fmt.Sprintf("Stok %s berubah, silakan ulangi transaksi", d.product.Name)})
			return
		}

		tx.Exec(`INSERT INTO stock_mutations (product_id,type,quantity,stock_before,stock_after,note,ref_id,user_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
			d.product.ID, "sale", d.qty, stockBefore, stockBefore-d.qty, "Penjualan "+invoice, txID, claims.UserID, now)

		txDetails = append(txDetails, models.TransactionDetail{
			TransactionID: txID, ProductID: d.product.ID, ProductName: d.product.Name,
			CategoryName: d.catName, Quantity: d.qty, UnitPrice: d.unitPrice,
			BuyPrice: d.buyPrice, Subtotal: d.subtotal, DiscountAmount:d.lineDiscount, NetSubtotal:d.netSubtotal, Profit: d.netSubtotal - d.buyPrice*float64(d.qty),
		})
	}

	if req.OnCredit {
		var curBalance float64
		if err := tx.QueryRow("SELECT debt_balance FROM customers WHERE id=? AND is_deleted=0", req.CustomerID).Scan(&curBalance); err != nil {
			writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal membaca saldo hutang pelanggan"})
			return
		}
		debtAmount := totalAmount
		if req.ServiceOrderID > 0 { debtAmount = paymentDue }
		newBalance := curBalance + debtAmount
		if _, err := tx.Exec("UPDATE customers SET debt_balance=?, updated_at=? WHERE id=?", newBalance, now, req.CustomerID); err != nil {
			writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal mencatat hutang pelanggan"})
			return
		}
		if _, err := tx.Exec(`INSERT INTO debt_ledger (customer_id, transaction_id, invoice_number, amount, type, note, balance_after, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)`, req.CustomerID, txID, invoice, debtAmount, "debt", "Pembelian "+invoice, newBalance, claims.UserID, now); err != nil {
			writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal menyimpan riwayat hutang"})
			return
		}
	}
	if req.ServiceOrderID > 0 {
		result, err := tx.Exec("UPDATE service_orders SET invoice_id=?,status='completed',updated_at=? WHERE id=? AND invoice_id IS NULL", txID, now, req.ServiceOrderID)
		if err != nil { writeJSON(w,500,models.APIResponse{Success:false,Error:"Gagal menautkan invoice servis"});return }
		if affected,_:=result.RowsAffected();affected!=1 { writeJSON(w,409,models.APIResponse{Success:false,Error:"Order servis sudah berubah"});return }
		tx.Exec("INSERT INTO service_progress(service_order_id,status,note,actor_id,created_at) VALUES(?,?,?,?,?)",req.ServiceOrderID,"completed","Invoice "+invoice+" dibuat",claims.UserID,now)
		queueTracking(tx, req.ServiceOrderID)
		tx.Exec("UPDATE service_parts SET reserved_quantity=0 WHERE service_order_id=?", req.ServiceOrderID)
	}
	// Create immutable payment records after the invoice exists.  Cash tender and
	// change never inflate revenue: the ledger only stores the amount applied.
	if req.PaymentMethod != "credit" && paymentDue > 0 {
		cashApplied := cashAmt
		if req.PaymentMethod == "cash" { cashApplied = paymentDue }
		if cashApplied > 0 { if _,err:=postPayment(tx,txID,req.ServiceOrderID,req.CustomerID,"invoice_payment","in","cash",cashApplied,"Pembayaran "+invoice,claims.UserID,now);err!=nil{writeJSON(w,500,models.APIResponse{Success:false,Error:"Gagal mencatat pembayaran"});return} }
		if qrisAmt > 0 { if _,err:=postPayment(tx,txID,req.ServiceOrderID,req.CustomerID,"invoice_payment","in","qris",qrisAmt,"Pembayaran "+invoice,claims.UserID,now);err!=nil{writeJSON(w,500,models.APIResponse{Success:false,Error:"Gagal mencatat pembayaran"});return} }
		if req.EwalletAmount > 0 { if _,err:=postPayment(tx,txID,req.ServiceOrderID,req.CustomerID,"invoice_payment","in",req.EwalletProvider,req.EwalletAmount,"Pembayaran "+invoice,claims.UserID,now);err!=nil{writeJSON(w,500,models.APIResponse{Success:false,Error:"Gagal mencatat pembayaran"});return} }
	}

	if err = tx.Commit(); err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal commit"})
		return
	}
	if req.ServiceOrderID > 0 { services.TriggerTrackingSync() }

	writeJSON(w, http.StatusCreated, models.APIResponse{
		Success: true, Message: "Transaksi berhasil",
		Data: models.Transaction{
			ID: txID, InvoiceNumber: invoice, UserID: claims.UserID, Username: claims.Username,
			TotalAmount: totalAmount, PaymentAmount: req.PaymentAmount, ChangeAmount: changeAmount,
			PaymentMethod: req.PaymentMethod, CashAmount: cashAmt, QRISAmount: qrisAmt,
			EwalletAmount: req.EwalletAmount, EwalletProvider: req.EwalletProvider,
			DiscountCode: discountCode, DiscountAmount: discountAmount, Status: "completed", Details: txDetails,
			AuditFields: models.AuditFields{Version: 1, CreatedAt: now, UpdatedAt: now},
		},
	})
}

func CancelTransaction(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	id, _ := strconv.ParseInt(mux.Vars(r)["id"], 10, 64)
	var req models.CancelRequest
	json.NewDecoder(r.Body).Decode(&req)
	if req.Reason == "" {
		req.Reason = "Dibatalkan oleh " + claims.Username
	}

	var t models.Transaction
	var customerID int64
	var onCredit int
	err := database.DB.QueryRow(
		"SELECT id, invoice_number, status, total_amount, COALESCE(customer_id,0), on_credit FROM transactions WHERE id=? AND is_deleted=0", id,
	).Scan(&t.ID, &t.InvoiceNumber, &t.Status, &t.TotalAmount, &customerID, &onCredit)
	if err != nil {
		writeJSON(w, http.StatusNotFound, models.APIResponse{Success: false, Error: "Transaksi tidak ditemukan"})
		return
	}
	if t.Status == "cancelled" {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Transaksi sudah dibatalkan"})
		return
	}

	rows, _ := database.DB.Query("SELECT td.product_id, td.quantity FROM transaction_details td JOIN products p ON p.id=td.product_id WHERE td.transaction_id=? AND p.item_type='physical'", id)
	type detRow struct {
		pid int64
		qty int
	}
	var drows []detRow
	for rows.Next() {
		var d detRow
		rows.Scan(&d.pid, &d.qty)
		drows = append(drows, d)
	}
	rows.Close()

	tx, err := database.DB.Begin()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal memulai transaksi"})
		return
	}
	now := time.Now()

	_, err = tx.Exec("UPDATE transactions SET status='cancelled',cancel_reason=?,updated_at=?,updated_by=?,version=version+1 WHERE id=?",
		req.Reason, now, claims.UserID, id)
	if err != nil {
		tx.Rollback()
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal cancel"})
		return
	}
	// A cancelled service invoice returns the work order to ready-to-bill. Its
	// physical spare parts are restored by the regular detail loop below.
	tx.Exec("UPDATE service_orders SET invoice_id=NULL,status='ready',updated_at=? WHERE invoice_id=?", now, id)

	for _, d := range drows {
		var sb int
		tx.QueryRow("SELECT stock FROM products WHERE id=?", d.pid).Scan(&sb)
		tx.Exec("UPDATE products SET stock=stock+?,updated_at=?,updated_by=?,version=version+1 WHERE id=?", d.qty, now, claims.UserID, d.pid)
		tx.Exec(`INSERT INTO stock_mutations (product_id,type,quantity,stock_before,stock_after,note,ref_id,user_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
			d.pid, "cancel", d.qty, sb, sb+d.qty, fmt.Sprintf("Cancel %s: %s", t.InvoiceNumber, req.Reason), id, claims.UserID, now)
	}
	if onCredit == 1 && customerID > 0 {
		var balance float64
		if err := tx.QueryRow("SELECT debt_balance FROM customers WHERE id=? AND is_deleted=0", customerID).Scan(&balance); err != nil || balance < t.TotalAmount {
			tx.Rollback()
			writeJSON(w, http.StatusConflict, models.APIResponse{Success: false, Error: "Saldo hutang pelanggan tidak valid"})
			return
		}
		newBalance := balance - t.TotalAmount
		if _, err := tx.Exec("UPDATE customers SET debt_balance=?, updated_at=? WHERE id=?", newBalance, now, customerID); err != nil {
			tx.Rollback()
			writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal membalik hutang pelanggan"})
			return
		}
		if _, err := tx.Exec(`INSERT INTO debt_ledger (customer_id, transaction_id, invoice_number, amount, type, note, balance_after, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)`, customerID, id, t.InvoiceNumber, t.TotalAmount, "payment", "Pembatalan transaksi "+t.InvoiceNumber, newBalance, claims.UserID, now); err != nil {
			tx.Rollback()
			writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal menyimpan pembalikan hutang"})
			return
		}
	}
	if err = tx.Commit(); err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Gagal commit"})
		return
	}
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true,
		Message: fmt.Sprintf("Transaksi %s dibatalkan. Stok dikembalikan.", t.InvoiceNumber)})
}

func GetTransactions(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	pageStr := r.URL.Query().Get("page")
	dateFrom := r.URL.Query().Get("date_from")
	dateTo := r.URL.Query().Get("date_to")
	status := r.URL.Query().Get("status")
	method := r.URL.Query().Get("method")
	search := r.URL.Query().Get("search")
	limit, page := 20, 1
	if l, e := strconv.Atoi(limitStr); e == nil && l > 0 {
		limit = l
	}
	if p, e := strconv.Atoi(pageStr); e == nil && p > 0 {
		page = p
	}
	offset := (page - 1) * limit

	// Validate date range
	if dateFrom != "" && dateTo != "" && dateTo < dateFrom {
		writeJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Error: "Tanggal akhir tidak boleh lebih kecil dari tanggal awal"})
		return
	}

	base := `FROM transactions t LEFT JOIN users u ON t.user_id=u.id WHERE t.is_deleted=0`
	args, ca := []interface{}{}, []interface{}{}
	if dateFrom != "" {
		base += " AND t.created_at >= ?"
		args = append(args, dateFrom)
		ca = append(ca, dateFrom)
	}
	if dateTo != "" {
		dateToEnd := dateTo + " 23:59:59"
		base += " AND t.created_at <= ?"
		args = append(args, dateToEnd)
		ca = append(ca, dateToEnd)
	}
	if status != "" {
		base += " AND t.status=?"
		args = append(args, status)
		ca = append(ca, status)
	}
	if method != "" {
		base += " AND t.payment_method=?"
		args = append(args, method)
		ca = append(ca, method)
	}
	if search != "" {
		s := "%" + search + "%"
		base += " AND t.invoice_number LIKE ?"
		args = append(args, s)
		ca = append(ca, s)
	}

	var total int
	database.DB.QueryRow("SELECT COUNT(*) "+base, ca...).Scan(&total)

	q := `SELECT t.id, t.invoice_number, t.user_id, COALESCE(u.username,'?'),
		t.total_amount, t.payment_amount, t.change_amount, t.payment_method,
		COALESCE(t.cash_amount,0), COALESCE(t.qris_amount,0),
		COALESCE(t.ewallet_amount,0), COALESCE(t.ewallet_provider,''),
		COALESCE(t.discount_code,''), COALESCE(t.discount_amount,0), COALESCE(t.ppn_amount,0),
		t.status, COALESCE(t.cancel_reason,''),
		t.version, t.created_at, t.updated_at ` + base + " ORDER BY t.created_at DESC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	rows, err := database.DB.Query(q, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	defer rows.Close()

	var list []models.Transaction
	for rows.Next() {
		var t models.Transaction
		rows.Scan(&t.ID, &t.InvoiceNumber, &t.UserID, &t.Username,
			&t.TotalAmount, &t.PaymentAmount, &t.ChangeAmount, &t.PaymentMethod,
			&t.CashAmount, &t.QRISAmount,
			&t.EwalletAmount, &t.EwalletProvider,
			&t.DiscountCode, &t.DiscountAmount, &t.PPNAmount, &t.Status, &t.CancelReason,
			&t.AuditFields.Version, &t.AuditFields.CreatedAt, &t.AuditFields.UpdatedAt)
		list = append(list, t)
	}
	if list == nil {
		list = []models.Transaction{}
	}
	writeJSON(w, http.StatusOK, models.PaginatedResponse{Success: true, Data: list, Total: total, Page: page, Limit: limit})
}

func GetTransaction(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(mux.Vars(r)["id"], 10, 64)
	var t models.Transaction
	err := database.DB.QueryRow(
		`SELECT t.id, t.invoice_number, t.user_id, COALESCE(u.username,'?'),
		t.total_amount, t.payment_amount, t.change_amount, t.payment_method,
		COALESCE(t.cash_amount,0), COALESCE(t.qris_amount,0),
		COALESCE(t.ewallet_amount,0), COALESCE(t.ewallet_provider,''),
		COALESCE(t.discount_code,''), COALESCE(t.discount_amount,0), COALESCE(t.ppn_amount,0),
		t.status, COALESCE(t.cancel_reason,''),
		t.version, t.created_at, t.updated_at
		FROM transactions t LEFT JOIN users u ON t.user_id=u.id
		WHERE t.id=? AND t.is_deleted=0`, id,
	).Scan(&t.ID, &t.InvoiceNumber, &t.UserID, &t.Username,
		&t.TotalAmount, &t.PaymentAmount, &t.ChangeAmount, &t.PaymentMethod,
		&t.CashAmount, &t.QRISAmount,
		&t.EwalletAmount, &t.EwalletProvider,
		&t.DiscountCode, &t.DiscountAmount, &t.PPNAmount, &t.Status, &t.CancelReason,
		&t.AuditFields.Version, &t.AuditFields.CreatedAt, &t.AuditFields.UpdatedAt)
	if err != nil {
		writeJSON(w, http.StatusNotFound, models.APIResponse{Success: false, Error: "Transaksi tidak ditemukan"})
		return
	}

	rows, _ := database.DB.Query(
		`SELECT td.id, td.transaction_id, td.product_id,
		COALESCE(td.product_name, COALESCE(p.name,'(dihapus)')),
		COALESCE(td.category_name,''),
		td.quantity, td.unit_price, COALESCE(td.buy_price,0), td.subtotal, td.created_at
		FROM transaction_details td LEFT JOIN products p ON td.product_id=p.id
		WHERE td.transaction_id=?`, id,
	)
	defer rows.Close()
	for rows.Next() {
		var d models.TransactionDetail
		rows.Scan(&d.ID, &d.TransactionID, &d.ProductID, &d.ProductName, &d.CategoryName,
			&d.Quantity, &d.UnitPrice, &d.BuyPrice, &d.Subtotal, &d.CreatedAt)
		d.Profit = d.Subtotal - d.BuyPrice*float64(d.Quantity)
		t.Details = append(t.Details, d)
	}
	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: t})
}

func GetDashboardStats(w http.ResponseWriter, r *http.Request) {
	var s models.DashboardStats
	today := time.Now().Format("2006-01-02")

	// ── Single query: all-time totals + today totals in one pass ─────────────
	database.DB.QueryRow(`
		SELECT
			COALESCE(SUM(CASE WHEN t.is_deleted=0 AND t.status='completed' THEN t.total_amount END), 0),
			COUNT(CASE WHEN t.is_deleted=0 AND t.status='completed' THEN 1 END),
			COALESCE(SUM(CASE WHEN t.is_deleted=0 AND t.status='completed' THEN td_sum.cogs END), 0),
			COALESCE(SUM(CASE WHEN t.is_deleted=0 AND t.status='completed' AND DATE(t.created_at)=? THEN t.total_amount END), 0),
			COUNT(CASE WHEN t.is_deleted=0 AND t.status='completed' AND DATE(t.created_at)=? THEN 1 END),
			COALESCE(SUM(CASE WHEN t.is_deleted=0 AND t.status='completed' AND DATE(t.created_at)=? THEN td_sum.cogs END), 0),
			COUNT(CASE WHEN t.is_deleted=0 AND t.status='cancelled' AND DATE(t.created_at)=? THEN 1 END)
		FROM transactions t
		LEFT JOIN (
			SELECT transaction_id, SUM(buy_price*quantity) as cogs
			FROM transaction_details GROUP BY transaction_id
		) td_sum ON td_sum.transaction_id = t.id`,
		today, today, today, today,
	).Scan(
		&s.TotalRevenue, &s.TotalTransactions, &s.TotalCOGS,
		&s.TodayRevenue, &s.TodayTransactions, &s.TodayProfit,
		&s.CancelledToday,
	)
	s.GrossProfit = s.TotalRevenue - s.TotalCOGS
	s.TodayProfit = s.TodayRevenue - s.TodayProfit // today_revenue - today_cogs

	// ── Products counts (fast — indexed) ─────────────────────────────────────
	database.DB.QueryRow(`
		SELECT
			COUNT(*),
			COUNT(CASE WHEN stock <= stock_min THEN 1 END)
		FROM products WHERE is_deleted=0`,
	).Scan(&s.TotalProducts, &s.LowStockProducts)

	s.ServerStatus = "online"

	// ── Weekly data (last 7 days) ─────────────────────────────────────────────
	weekRows, _ := database.DB.Query(`
		SELECT
			DATE(t.created_at) as day,
			COALESCE(SUM(t.total_amount), 0) as rev,
			COALESCE(SUM(td_sum.cogs), 0) as cogs,
			COUNT(DISTINCT t.id) as tx_count
		FROM transactions t
		LEFT JOIN (
			SELECT transaction_id, SUM(buy_price*quantity) as cogs
			FROM transaction_details GROUP BY transaction_id
		) td_sum ON td_sum.transaction_id = t.id
		WHERE t.status='completed' AND t.is_deleted=0
		AND t.created_at >= DATE('now','-6 days')
		GROUP BY DATE(t.created_at) ORDER BY day`,
	)
	if weekRows != nil {
		defer weekRows.Close()
		dayMap := map[string]models.WeeklyDay{}
		for weekRows.Next() {
			var d models.WeeklyDay
			var cogs float64
			weekRows.Scan(&d.Date, &d.Revenue, &cogs, &d.TxCount)
			d.Profit = d.Revenue - cogs
			dayMap[d.Date] = d
		}
		dayNames := []string{"Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"}
		for i := 6; i >= 0; i-- {
			t := time.Now().AddDate(0, 0, -i)
			date := t.Format("2006-01-02")
			wd := models.WeeklyDay{Date: date, Day: dayNames[t.Weekday()]}
			if ex, ok := dayMap[date]; ok {
				wd.Revenue = ex.Revenue
				wd.Profit = ex.Profit
				wd.TxCount = ex.TxCount
			}
			s.WeeklyData = append(s.WeeklyData, wd)
		}
	}

	writeJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: s})
}
