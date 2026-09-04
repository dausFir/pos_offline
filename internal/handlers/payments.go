package handlers

import (
	"database/sql"
	"fmt"
	"time"
)

func validPaymentMethod(method string) bool {
	return map[string]bool{"cash":true,"qris":true,"gopay":true,"ovo":true,"dana":true,"linkaja":true,"shopeepay":true,"transfer":true}[method]
}

func paymentReceiptNumber(tx *sql.Tx, now time.Time) (string, error) {
	key := now.Format("20060102")
	var seq int
	err := tx.QueryRow("SELECT last_seq FROM receipt_sequence WHERE date_key=?", key).Scan(&seq)
	if err == sql.ErrNoRows {
		_, err = tx.Exec("INSERT INTO receipt_sequence(date_key,last_seq) VALUES(?,1)", key)
		seq = 1
	} else if err == nil {
		seq++
		_, err = tx.Exec("UPDATE receipt_sequence SET last_seq=? WHERE date_key=?", seq, key)
	}
	if err != nil { return "", err }
	return fmt.Sprintf("RCPT-%s-%05d", key, seq), nil
}

func openShiftID(tx *sql.Tx, userID int64) interface{} {
	var id int64
	if err := tx.QueryRow("SELECT id FROM cash_shifts WHERE user_id=? AND status='open' ORDER BY opened_at DESC LIMIT 1", userID).Scan(&id); err != nil { return nil }
	return id
}

func postPayment(tx *sql.Tx, transactionID, serviceOrderID, customerID int64, typ, direction, method string, amount float64, note string, userID int64, now time.Time) (string, error) {
	if amount <= 0 { return "", nil }
	receipt, err := paymentReceiptNumber(tx, now)
	if err != nil { return "", err }
	var tid, sid, cid interface{}
	if transactionID > 0 { tid=transactionID }; if serviceOrderID > 0 { sid=serviceOrderID }; if customerID > 0 { cid=customerID }
	shift := openShiftID(tx, userID)
	_, err = tx.Exec(`INSERT INTO payment_ledger(receipt_number,transaction_id,service_order_id,customer_id,shift_id,type,direction,payment_method,amount,note,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`, receipt,tid,sid,cid,shift,typ,direction,method,amount,note,userID,now)
	return receipt, err
}
