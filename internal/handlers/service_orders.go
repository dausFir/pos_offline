package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/base64"
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

var serviceStatuses = map[string]bool{"received": true, "diagnosis": true, "awaiting_approval": true, "awaiting_parts": true, "in_progress": true, "ready": true, "completed": true, "cancelled": true}

func serviceOrderNumber(tx *sql.Tx) (string, error) {
	key := time.Now().Format("20060102")
	var seq int
	err := tx.QueryRow("SELECT last_seq FROM service_order_sequence WHERE date_key=?", key).Scan(&seq)
	if err == sql.ErrNoRows { _, err = tx.Exec("INSERT INTO service_order_sequence(date_key,last_seq) VALUES(?,1)", key); seq = 1
	} else if err == nil { seq++; _, err = tx.Exec("UPDATE service_order_sequence SET last_seq=? WHERE date_key=?", seq, key) }
	if err != nil { return "", err }
	return fmt.Sprintf("SRV-%s-%04d", key, seq), nil
}

func randomTrackingToken() (string, error) { b := make([]byte, 24); if _, err := rand.Read(b); err != nil { return "", err }; return base64.RawURLEncoding.EncodeToString(b), nil }

func scanServiceOrder(s interface{ Scan(...interface{}) error }, o *models.ServiceOrder) error {
	return s.Scan(&o.ID, &o.OrderNumber, &o.CustomerID, &o.CustomerName, &o.CustomerPhone, &o.ServiceProductID, &o.ItemName, &o.ItemBrand, &o.ItemSerial, &o.Complaint, &o.Diagnosis, &o.Status, &o.TechnicianID, &o.TechnicianName, &o.EstimatedCost, &o.DepositAmount, &o.DueAt, &o.TrackingToken, &o.InvoiceID, &o.InvoiceNumber, &o.Notes, &o.CreatedAt, &o.UpdatedAt)
}

const serviceOrderSelect = `SELECT s.id,s.order_number,s.customer_id,COALESCE(c.name,''),COALESCE(c.phone,''),COALESCE(s.service_product_id,0),s.item_name,s.item_brand,s.item_serial,s.complaint,s.diagnosis,s.status,s.technician_id,COALESCE(u.username,''),s.estimated_cost,s.deposit_amount,s.due_at,s.tracking_token,s.invoice_id,COALESCE(t.invoice_number,''),s.notes,s.created_at,s.updated_at FROM service_orders s LEFT JOIN customers c ON c.id=s.customer_id LEFT JOIN users u ON u.id=s.technician_id LEFT JOIN transactions t ON t.id=s.invoice_id`

func hydrateServiceOrder(o *models.ServiceOrder) {
	o.CustomerIDv, o.TechnicianIDv = o.CustomerID.Int64, o.TechnicianID.Int64
	if o.DueAt.Valid { o.DueAtValue = o.DueAt.Time.Format(time.RFC3339) }
	rows, _ := database.DB.Query(`SELECT p.id,p.service_order_id,p.status,p.note,COALESCE(u.username,''),p.created_at FROM service_progress p LEFT JOIN users u ON u.id=p.actor_id WHERE p.service_order_id=? ORDER BY p.created_at`, o.ID)
	if rows != nil { defer rows.Close(); for rows.Next() { var x models.ServiceProgress; rows.Scan(&x.ID,&x.ServiceOrderID,&x.Status,&x.Note,&x.ActorName,&x.CreatedAt); o.Progress=append(o.Progress,x) } }
	rows, _ = database.DB.Query(`SELECT sp.id,sp.service_order_id,sp.product_id,p.name,sp.quantity,sp.unit_price,sp.quantity*sp.unit_price,sp.reserved_quantity FROM service_parts sp JOIN products p ON p.id=sp.product_id WHERE sp.service_order_id=? ORDER BY sp.id`, o.ID)
	if rows != nil { defer rows.Close(); for rows.Next() { var x models.ServicePart; rows.Scan(&x.ID,&x.ServiceOrderID,&x.ProductID,&x.ProductName,&x.Quantity,&x.UnitPrice,&x.Subtotal,&x.ReservedQuantity); o.Parts=append(o.Parts,x) } }
	rows, _ = database.DB.Query(`SELECT id,service_order_id,cost_type,description,amount,created_at FROM service_costs WHERE service_order_id=? ORDER BY created_at`,o.ID)
	if rows != nil { defer rows.Close(); for rows.Next(){var x models.ServiceCost;rows.Scan(&x.ID,&x.ServiceOrderID,&x.CostType,&x.Description,&x.Amount,&x.CreatedAt);o.Costs=append(o.Costs,x)} }
	database.DB.QueryRow(`SELECT COALESCE(SUM(CASE WHEN direction='in' AND type='service_deposit' THEN amount WHEN direction='out' AND type='refund' THEN -amount ELSE 0 END),0) FROM payment_ledger WHERE service_order_id=?`,o.ID).Scan(&o.DepositBalance)
	if o.EstimatedCost > o.DepositBalance { o.OutstandingAmount=o.EstimatedCost-o.DepositBalance }
	if o.Progress == nil { o.Progress=[]models.ServiceProgress{} }; if o.Parts == nil { o.Parts=[]models.ServicePart{} };if o.Costs==nil{o.Costs=[]models.ServiceCost{}}
}

func queueTracking(tx *sql.Tx, orderID int64) {
	var o models.ServiceOrder
	if err := scanServiceOrder(tx.QueryRow(serviceOrderSelect+" WHERE s.id=?", orderID), &o); err != nil { return }
	o.CustomerIDv, o.TechnicianIDv = o.CustomerID.Int64, o.TechnicianID.Int64
	payload, err := json.Marshal(map[string]interface{}{"orders": []map[string]interface{}{{"tracking_token":o.TrackingToken,"order_number":o.OrderNumber,"item_name":o.ItemName,"item_brand":o.ItemBrand,"status":o.Status,"technician_name":o.TechnicianName,"estimated_cost":o.EstimatedCost,"deposit_amount":o.DepositAmount,"updated_at":o.UpdatedAt.Format(time.RFC3339)}}})
	if err != nil { return }
	event, err := randomTrackingToken(); if err != nil { return }
	tx.Exec("INSERT INTO tracking_outbox(event_id,service_order_id,payload) VALUES(?,?,?)", event, orderID, string(payload))
}

func GetServiceOrders(w http.ResponseWriter, r *http.Request) {
	status, search := r.URL.Query().Get("status"), r.URL.Query().Get("search")
	q, args := serviceOrderSelect+" WHERE 1=1", []interface{}{}
	if status != "" { q += " AND s.status=?"; args=append(args,status) }
	if search != "" { q += " AND (s.order_number LIKE ? OR s.item_name LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)"; like:="%"+search+"%"; args=append(args,like,like,like,like) }
	q += " ORDER BY s.updated_at DESC LIMIT 200"
	rows, err := database.DB.Query(q,args...); if err != nil { writeJSON(w,500,models.APIResponse{Success:false,Error:"Gagal memuat order servis"});return }; defer rows.Close()
	orders:=[]models.ServiceOrder{}; for rows.Next(){ var o models.ServiceOrder; if scanServiceOrder(rows,&o)==nil { hydrateServiceOrder(&o); orders=append(orders,o) } }
	writeJSON(w,200,models.APIResponse{Success:true,Data:orders})
}

func GetServiceOrder(w http.ResponseWriter, r *http.Request) { id,_:=strconv.ParseInt(mux.Vars(r)["id"],10,64); var o models.ServiceOrder; if err:=scanServiceOrder(database.DB.QueryRow(serviceOrderSelect+" WHERE s.id=?",id),&o);err!=nil{writeJSON(w,404,models.APIResponse{Success:false,Error:"Order servis tidak ditemukan"});return};hydrateServiceOrder(&o);writeJSON(w,200,models.APIResponse{Success:true,Data:o}) }

func CreateServiceOrder(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r); var req models.ServiceOrderRequest
	if json.NewDecoder(r.Body).Decode(&req)!=nil || req.ItemName=="" || req.CustomerID<=0 || req.ServiceProductID<=0 { writeJSON(w,400,models.APIResponse{Success:false,Error:"Pelanggan, layanan, dan barang servis wajib diisi"});return }
	if req.EstimatedCost<0 || req.DepositAmount<0 || (req.DepositAmount>0 && !validPaymentMethod(req.DepositPaymentMethod)) { writeJSON(w,400,models.APIResponse{Success:false,Error:"DP dan metode pembayaran wajib valid"});return }
	tx,err:=database.DB.Begin();if err!=nil{writeJSON(w,500,models.APIResponse{Success:false,Error:"Gagal membuat order"});return};defer tx.Rollback()
	var exists int; if tx.QueryRow("SELECT COUNT(*) FROM customers WHERE id=? AND is_deleted=0",req.CustomerID).Scan(&exists)!=nil||exists!=1{writeJSON(w,400,models.APIResponse{Success:false,Error:"Pelanggan tidak ditemukan"});return}; if tx.QueryRow("SELECT COUNT(*) FROM products WHERE id=? AND item_type='service' AND is_deleted=0",req.ServiceProductID).Scan(&exists)!=nil||exists!=1{writeJSON(w,400,models.APIResponse{Success:false,Error:"Master jasa tidak ditemukan"});return}
	number,err:=serviceOrderNumber(tx);if err!=nil{writeJSON(w,500,models.APIResponse{Success:false,Error:"Gagal memberi nomor order"});return}; token,err:=randomTrackingToken();if err!=nil{writeJSON(w,500,models.APIResponse{Success:false,Error:"Gagal membuat token tracking"});return}
	var due,tech interface{};if req.DueAt!="" { d,e:=time.Parse(time.RFC3339,req.DueAt);if e!=nil{writeJSON(w,400,models.APIResponse{Success:false,Error:"Format jatuh tempo tidak valid"});return};due=d };if req.TechnicianID>0{tech=req.TechnicianID}
	now:=time.Now();res,err:=tx.Exec(`INSERT INTO service_orders(order_number,customer_id,service_product_id,item_name,item_brand,item_serial,complaint,diagnosis,status,technician_id,estimated_cost,deposit_amount,due_at,tracking_token,notes,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,number,req.CustomerID,req.ServiceProductID,req.ItemName,req.ItemBrand,req.ItemSerial,req.Complaint,req.Diagnosis,"received",tech,req.EstimatedCost,0,due,token,req.Notes,claims.UserID,now,now);if err!=nil{writeJSON(w,500,models.APIResponse{Success:false,Error:"Gagal menyimpan order"});return};id,_:=res.LastInsertId()
	if req.DepositAmount>0 { if _,err:=postPayment(tx,0,id,req.CustomerID,"service_deposit","in",req.DepositPaymentMethod,req.DepositAmount,"DP "+number,claims.UserID,now);err!=nil{writeJSON(w,500,models.APIResponse{Success:false,Error:"Gagal mencatat DP"});return};tx.Exec("UPDATE service_orders SET deposit_amount=? WHERE id=?",req.DepositAmount,id) }
	tx.Exec("INSERT INTO service_progress(service_order_id,status,note,actor_id,created_at) VALUES(?,?,?,?,?)",id,"received","Barang diterima",claims.UserID,now);queueTracking(tx,id);if err=tx.Commit();err!=nil{writeJSON(w,500,models.APIResponse{Success:false,Error:"Gagal menyimpan order"});return}; services.TriggerTrackingSync();writeJSON(w,201,models.APIResponse{Success:true,Message:"Order servis dibuat",Data:map[string]interface{}{"id":id,"order_number":number,"tracking_token":token}})
}

func UpdateServiceStatus(w http.ResponseWriter,r *http.Request){claims:=middleware.GetClaims(r);id,_:=strconv.ParseInt(mux.Vars(r)["id"],10,64);var req models.ServiceStatusRequest;if json.NewDecoder(r.Body).Decode(&req)!=nil||!serviceStatuses[req.Status]{writeJSON(w,400,models.APIResponse{Success:false,Error:"Status servis tidak valid"});return};tx,err:=database.DB.Begin();if err!=nil{writeJSON(w,500,models.APIResponse{Success:false,Error:"Gagal update order"});return};defer tx.Rollback();var invoice sql.NullInt64;if tx.QueryRow("SELECT invoice_id FROM service_orders WHERE id=?",id).Scan(&invoice)!=nil{writeJSON(w,404,models.APIResponse{Success:false,Error:"Order servis tidak ditemukan"});return};if invoice.Valid&&req.Status!="completed"{writeJSON(w,400,models.APIResponse{Success:false,Error:"Order yang sudah ditagihkan tidak dapat diubah"});return};var tech interface{}=nil;if req.TechnicianID>0{tech=req.TechnicianID};now:=time.Now();tx.Exec("UPDATE service_orders SET status=?,technician_id=COALESCE(?,technician_id),updated_at=? WHERE id=?",req.Status,tech,now,id);if req.Status=="cancelled" { tx.Exec("UPDATE service_parts SET reserved_quantity=0 WHERE service_order_id=?",id) };tx.Exec("INSERT INTO service_progress(service_order_id,status,note,actor_id,created_at) VALUES(?,?,?,?,?)",id,req.Status,req.Note,claims.UserID,now);queueTracking(tx,id);if err=tx.Commit();err!=nil{writeJSON(w,500,models.APIResponse{Success:false,Error:"Gagal update order"});return};services.TriggerTrackingSync();writeJSON(w,200,models.APIResponse{Success:true,Message:"Progress servis diperbarui"})}

func AddServicePart(w http.ResponseWriter,r *http.Request){id,_:=strconv.ParseInt(mux.Vars(r)["id"],10,64);var req models.ServicePartRequest;if json.NewDecoder(r.Body).Decode(&req)!=nil||req.ProductID<=0||req.Quantity<=0{writeJSON(w,400,models.APIResponse{Success:false,Error:"Sparepart dan jumlah wajib valid"});return};tx,err:=database.DB.Begin();if err!=nil{writeJSON(w,500,models.APIResponse{Success:false,Error:"Gagal menambah sparepart"});return};defer tx.Rollback();var price float64;var typ string;if tx.QueryRow("SELECT sell_price,item_type FROM products WHERE id=? AND is_deleted=0",req.ProductID).Scan(&price,&typ)!=nil||typ!="physical"{writeJSON(w,400,models.APIResponse{Success:false,Error:"Sparepart fisik tidak ditemukan"});return};var billed sql.NullInt64;if tx.QueryRow("SELECT invoice_id FROM service_orders WHERE id=?",id).Scan(&billed)!=nil||billed.Valid{writeJSON(w,400,models.APIResponse{Success:false,Error:"Order sudah ditagihkan atau tidak ditemukan"});return};if req.UnitPrice<=0{req.UnitPrice=price};_,err=tx.Exec(`INSERT INTO service_parts(service_order_id,product_id,quantity,unit_price,reserved_quantity) VALUES(?,?,?,?,0) ON CONFLICT(service_order_id,product_id) DO UPDATE SET quantity=excluded.quantity,unit_price=excluded.unit_price,reserved_quantity=0`,id,req.ProductID,req.Quantity,req.UnitPrice);if err!=nil{writeJSON(w,500,models.APIResponse{Success:false,Error:"Gagal simpan sparepart"});return};tx.Exec("UPDATE service_orders SET updated_at=? WHERE id=?",time.Now(),id);queueTracking(tx,id);if err=tx.Commit();err!=nil{writeJSON(w,500,models.APIResponse{Success:false,Error:"Gagal simpan sparepart"});return};services.TriggerTrackingSync();writeJSON(w,200,models.APIResponse{Success:true,Message:"Sparepart masuk estimasi; stok dipotong saat pelunasan"})}

func RecordServiceDeposit(w http.ResponseWriter,r *http.Request) { claims:=middleware.GetClaims(r); id,_:=strconv.ParseInt(mux.Vars(r)["id"],10,64); var req models.PaymentRequest; if json.NewDecoder(r.Body).Decode(&req)!=nil||req.Amount<=0||!validPaymentMethod(req.PaymentMethod){writeJSON(w,400,models.APIResponse{Success:false,Error:"Nominal atau metode DP tidak valid"});return}; tx,err:=database.DB.Begin();if err!=nil{writeJSON(w,500,models.APIResponse{Success:false,Error:"Gagal mencatat DP"});return};defer tx.Rollback();var customerID int64;var status string;if tx.QueryRow("SELECT customer_id,status FROM service_orders WHERE id=? AND invoice_id IS NULL",id).Scan(&customerID,&status)!=nil||status=="cancelled"{writeJSON(w,400,models.APIResponse{Success:false,Error:"Order tidak dapat menerima DP"});return};now:=time.Now();receipt,err:=postPayment(tx,0,id,customerID,"service_deposit","in",req.PaymentMethod,req.Amount,req.Note,claims.UserID,now);if err!=nil{writeJSON(w,500,models.APIResponse{Success:false,Error:"Gagal menyimpan pembayaran DP"});return};tx.Exec("UPDATE service_orders SET deposit_amount=deposit_amount+?,updated_at=? WHERE id=?",req.Amount,now,id);queueTracking(tx,id);if err=tx.Commit();err!=nil{writeJSON(w,500,models.APIResponse{Success:false,Error:"Gagal menyimpan pembayaran DP"});return};services.TriggerTrackingSync();writeJSON(w,201,models.APIResponse{Success:true,Message:"DP servis dicatat",Data:map[string]interface{}{"receipt_number":receipt}}) }

func AddServiceCost(w http.ResponseWriter,r *http.Request) { claims:=middleware.GetClaims(r);id,_:=strconv.ParseInt(mux.Vars(r)["id"],10,64);var req models.ServiceCostRequest;if json.NewDecoder(r.Body).Decode(&req)!=nil||req.Amount<=0||(req.CostType!="labor"&&req.CostType!="external"&&req.CostType!="other"){writeJSON(w,400,models.APIResponse{Success:false,Error:"Biaya kerja tidak valid"});return};result,err:=database.DB.Exec(`INSERT INTO service_costs(service_order_id,cost_type,description,amount,created_by,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM service_orders WHERE id=? AND invoice_id IS NULL)`,id,req.CostType,req.Description,req.Amount,claims.UserID,time.Now(),id);if err!=nil{writeJSON(w,500,models.APIResponse{Success:false,Error:"Gagal mencatat biaya"});return};if n,_:=result.RowsAffected();n==0{writeJSON(w,400,models.APIResponse{Success:false,Error:"Order sudah ditagihkan atau tidak ditemukan"});return};writeJSON(w,201,models.APIResponse{Success:true,Message:"Biaya pekerjaan dicatat"}) }

func ReserveServiceParts(w http.ResponseWriter,r *http.Request) { id,_:=strconv.ParseInt(mux.Vars(r)["id"],10,64);tx,err:=database.DB.Begin();if err!=nil{writeJSON(w,500,models.APIResponse{Success:false,Error:"Gagal reservasi sparepart"});return};defer tx.Rollback();var billed sql.NullInt64;if tx.QueryRow("SELECT invoice_id FROM service_orders WHERE id=?",id).Scan(&billed)!=nil||billed.Valid{writeJSON(w,400,models.APIResponse{Success:false,Error:"Order sudah ditagihkan atau tidak ditemukan"});return};rows,err:=tx.Query("SELECT product_id,quantity FROM service_parts WHERE service_order_id=?",id);if err!=nil{writeJSON(w,500,models.APIResponse{Success:false,Error:"Gagal membaca sparepart"});return};defer rows.Close();for rows.Next(){var pid int64;var qty,stock,reserved int;rows.Scan(&pid,&qty);if tx.QueryRow("SELECT stock FROM products WHERE id=? AND is_deleted=0",pid).Scan(&stock)!=nil{writeJSON(w,400,models.APIResponse{Success:false,Error:"Sparepart tidak ditemukan"});return};tx.QueryRow("SELECT COALESCE(SUM(reserved_quantity),0) FROM service_parts WHERE product_id=? AND service_order_id<>?",pid,id).Scan(&reserved);if stock<reserved+qty{writeJSON(w,409,models.APIResponse{Success:false,Error:"Stok tidak cukup untuk reservasi sparepart"});return}};tx.Exec("UPDATE service_parts SET reserved_quantity=quantity WHERE service_order_id=?",id);if err=tx.Commit();err!=nil{writeJSON(w,500,models.APIResponse{Success:false,Error:"Gagal reservasi sparepart"});return};writeJSON(w,200,models.APIResponse{Success:true,Message:"Sparepart berhasil direservasi"}) }
