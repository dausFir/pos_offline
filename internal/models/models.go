package models

import (
	"database/sql"
	"time"
)

// ── Audit fields ─────────────────────────────────────────────────────────────
type AuditFields struct {
	IsDeleted         int           `json:"is_deleted,omitempty"`
	Version           int           `json:"version"`
	CreatedAt         time.Time     `json:"created_at"`
	CreatedBy         sql.NullInt64 `json:"-"`
	CreatedByUsername string        `json:"created_by,omitempty"`
	UpdatedAt         time.Time     `json:"updated_at"`
	UpdatedBy         sql.NullInt64 `json:"-"`
	UpdatedByUsername string        `json:"updated_by,omitempty"`
	DeletedAt         sql.NullTime  `json:"deleted_at,omitempty"`
	DeletedBy         sql.NullInt64 `json:"-"`
	DeletedByUsername string        `json:"deleted_by,omitempty"`
}

// ── Core entities ─────────────────────────────────────────────────────────────

type User struct {
	ID           int64  `json:"id"`
	Username     string `json:"username"`
	PasswordHash string `json:"-"`
	Role         string `json:"role"`
	AuditFields
}

// Kritis #3: Category
type Category struct {
	ID           int64  `json:"id"`
	Name         string `json:"name"`
	Description  string `json:"description"`
	Color        string `json:"color"`
	ProductCount int    `json:"product_count,omitempty"`
	AuditFields
}

// Kritis #3 + #4: Category & stock_min added
type Product struct {
	ID           int64         `json:"id"`
	BarcodeSKU   string        `json:"barcode_sku"`
	Name         string        `json:"name"`
	CategoryID   sql.NullInt64 `json:"-"`
	CategoryIDv  int64         `json:"category_id"`
	CategoryName string        `json:"category_name,omitempty"`
	BuyPrice     float64       `json:"buy_price"`
	SellPrice    float64       `json:"sell_price"`
	Stock        int           `json:"stock"`
	StockMin     int           `json:"stock_min"` // threshold per-produk
	Profit       float64       `json:"profit"`    // computed: sell - buy
	MarginPct    float64       `json:"margin_pct"`
	AuditFields
}

type Transaction struct {
	ID             int64               `json:"id"`
	InvoiceNumber  string              `json:"invoice_number"`
	UserID         int64               `json:"user_id"`
	Username       string              `json:"username,omitempty"`
	TotalAmount    float64             `json:"total_amount"`
	PaymentAmount  float64             `json:"payment_amount"`
	ChangeAmount   float64             `json:"change_amount"`
	PaymentMethod  string              `json:"payment_method"` // cash | qris | split
	CashAmount     float64             `json:"cash_amount"`    // Kritis #6: split
	QRISAmount     float64             `json:"qris_amount"`
	DiscountCode   string              `json:"discount_code,omitempty"`
	DiscountAmount float64             `json:"discount_amount,omitempty"`
	PPNAmount      float64             `json:"ppn_amount,omitempty"` // PPN/tax amount
	Status         string              `json:"status"`
	CancelReason   string              `json:"cancel_reason,omitempty"`
	Details        []TransactionDetail `json:"details,omitempty"`
	AuditFields
}

type TransactionDetail struct {
	ID            int64     `json:"id"`
	TransactionID int64     `json:"transaction_id"`
	ProductID     int64     `json:"product_id"`
	ProductName   string    `json:"product_name,omitempty"`
	CategoryName  string    `json:"category_name,omitempty"`
	Quantity      int       `json:"quantity"`
	UnitPrice     float64   `json:"unit_price"`
	BuyPrice      float64   `json:"buy_price"` // snapshot harga beli
	Subtotal      float64   `json:"subtotal"`
	Profit        float64   `json:"profit"` // computed
	CreatedAt     time.Time `json:"created_at"`
}

type StockMutation struct {
	ID          int64         `json:"id"`
	ProductID   int64         `json:"product_id"`
	ProductName string        `json:"product_name,omitempty"`
	BarcodeSKU  string        `json:"barcode_sku,omitempty"`
	Type        string        `json:"type"`
	Quantity    int           `json:"quantity"`
	StockBefore int           `json:"stock_before"`
	StockAfter  int           `json:"stock_after"`
	Note        string        `json:"note"`
	RefID       sql.NullInt64 `json:"-"`
	UserID      int64         `json:"user_id"`
	Username    string        `json:"username,omitempty"`
	CreatedAt   time.Time     `json:"created_at"`
}

type Discount struct {
	ID          int64   `json:"id"`
	Code        string  `json:"code"`
	Name        string  `json:"name"`
	Type        string  `json:"type"`
	Value       float64 `json:"value"`
	MinPurchase float64 `json:"min_purchase"`
	IsActive    bool    `json:"is_active"`
	AuditFields
}

// Kritis #7: Login log
type LoginLog struct {
	ID        int64     `json:"id"`
	UserID    int64     `json:"user_id"`
	Username  string    `json:"username"`
	IPAddress string    `json:"ip_address"`
	UserAgent string    `json:"user_agent"`
	Status    string    `json:"status"` // success | failed
	Reason    string    `json:"reason,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// Kritis #2: Profit report
type ProfitReport struct {
	Period       string  `json:"period"`
	TotalRevenue float64 `json:"total_revenue"`
	TotalCOGS    float64 `json:"total_cogs"` // cost of goods sold
	GrossProfit  float64 `json:"gross_profit"`
	MarginPct    float64 `json:"margin_pct"`
	TxCount      int     `json:"tx_count"`
	ItemsSold    int     `json:"items_sold"`
	AvgTicket    float64 `json:"avg_ticket"`
}

type ProfitByCategory struct {
	CategoryName string  `json:"category_name"`
	Revenue      float64 `json:"revenue"`
	COGS         float64 `json:"cogs"`
	Profit       float64 `json:"profit"`
	MarginPct    float64 `json:"margin_pct"`
	ItemsSold    int     `json:"items_sold"`
}

type AppSettings struct {
	StoreName     string  `json:"store_name"`
	StoreAddress  string  `json:"store_address"`
	QRISImageB64  string  `json:"qris_image_b64"`
	QRISNotes     string  `json:"qris_notes"`
	PPNPercent    float64 `json:"ppn_percent"` // 0 = no tax
	ReceiptFooter string  `json:"receipt_footer"`
}

// ── Requests ──────────────────────────────────────────────────────────────────

type Session struct {
	ID               int64     `json:"id"`
	UserID           int64     `json:"user_id"`
	RefreshTokenHash string    `json:"-"`
	DeviceInfo       string    `json:"device_info"`
	IPAddress        string    `json:"ip_address"`
	CreatedAt        time.Time `json:"created_at"`
	LastActivity     time.Time `json:"last_activity"`
	ExpiresAt        time.Time `json:"expires_at"`
	IsActive         bool      `json:"is_active"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	User         User   `json:"user"`
	ExpiresIn    int    `json:"expires_in"` // access token expiry in seconds
}

type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type RefreshTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
}

type CheckoutItem struct {
	ProductID int64 `json:"product_id"`
	Quantity  int   `json:"quantity"`
}

// Kritis #6: split payment
type CheckoutRequestV2 struct {
	Items         []CheckoutItem `json:"items"`
	PaymentAmount float64        `json:"payment_amount"`
	PaymentMethod string         `json:"payment_method"` // cash | qris | split
	CashAmount    float64        `json:"cash_amount"`
	QRISAmount    float64        `json:"qris_amount"`
	DiscountCode  string         `json:"discount_code"`
}

type CancelRequest struct {
	Reason string `json:"reason"`
}

// Kritis #3
type CategoryRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Color       string `json:"color"`
}

// Kritis #3 + #4
type ProductRequest struct {
	BarcodeSKU string  `json:"barcode_sku"`
	Name       string  `json:"name"`
	CategoryID int64   `json:"category_id"`
	BuyPrice   float64 `json:"buy_price"`
	SellPrice  float64 `json:"sell_price"`
	Stock      int     `json:"stock"`
	StockMin   int     `json:"stock_min"`
}

type UserRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

// Kritis #1: Change password
type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

type StockMutationRequest struct {
	ProductID int64  `json:"product_id"`
	Type      string `json:"type"`
	Quantity  int    `json:"quantity"`
	Note      string `json:"note"`
}

type DiscountRequest struct {
	Code        string  `json:"code"`
	Name        string  `json:"name"`
	Type        string  `json:"type"`
	Value       float64 `json:"value"`
	MinPurchase float64 `json:"min_purchase"`
	IsActive    bool    `json:"is_active"`
}

type SettingsRequest struct {
	StoreName     string  `json:"store_name"`
	StoreAddress  string  `json:"store_address"`
	QRISImageB64  string  `json:"qris_image_b64"`
	QRISNotes     string  `json:"qris_notes"`
	PPNPercent    float64 `json:"ppn_percent"`
	ReceiptFooter string  `json:"receipt_footer"`
}

type APIResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

type PaginatedResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data"`
	Total   int         `json:"total"`
	Page    int         `json:"page"`
	Limit   int         `json:"limit"`
}

type WeeklyDay struct {
	Day     string  `json:"day"`
	Date    string  `json:"date"`
	Revenue float64 `json:"revenue"`
	Profit  float64 `json:"profit"`
	TxCount int     `json:"tx_count"`
}

type DashboardStats struct {
	TotalRevenue      float64     `json:"total_revenue"`
	TotalCOGS         float64     `json:"total_cogs"`
	GrossProfit       float64     `json:"gross_profit"`
	TotalTransactions int         `json:"total_transactions"`
	TotalProducts     int         `json:"total_products"`
	LowStockProducts  int         `json:"low_stock_products"`
	TodayRevenue      float64     `json:"today_revenue"`
	TodayProfit       float64     `json:"today_profit"`
	TodayTransactions int         `json:"today_transactions"`
	CancelledToday    int         `json:"cancelled_today"`
	ServerStatus      string      `json:"server_status"`
	ServerIP          string      `json:"server_ip"`
	WeeklyData        []WeeklyDay `json:"weekly_data"`
}

// ── Penting #1: Laporan per Kasir/Shift ──────────────────────────────────────
type ShiftReport struct {
	UserID         int64   `json:"user_id"`
	Username       string  `json:"username"`
	TxCount        int     `json:"tx_count"`
	TotalRevenue   float64 `json:"total_revenue"`
	TotalProfit    float64 `json:"total_profit"`
	CancelledCount int     `json:"cancelled_count"`
	AvgTicket      float64 `json:"avg_ticket"`
	Date           string  `json:"date"`
}

// ── Penting #2: Hold Transaksi ────────────────────────────────────────────────
type HoldOrder struct {
	ID        string      `json:"id"`
	Label     string      `json:"label"`
	Items     interface{} `json:"items"`
	Total     float64     `json:"total"`
	CreatedAt string      `json:"created_at"`
}

// ── Penting #3: Harga Grosir/Member ──────────────────────────────────────────
type PriceTier struct {
	ID        int64   `json:"id"`
	ProductID int64   `json:"product_id"`
	Label     string  `json:"label"`   // Grosir, Member, dll
	MinQty    int     `json:"min_qty"` // minimal beli X
	Price     float64 `json:"price"`
	CreatedAt string  `json:"created_at,omitempty"`
}

type PriceTierRequest struct {
	ProductID int64   `json:"product_id"`
	Label     string  `json:"label"`
	MinQty    int     `json:"min_qty"`
	Price     float64 `json:"price"`
}

// ── Penting #5: Customer & Piutang ───────────────────────────────────────────
type Customer struct {
	ID          int64   `json:"id"`
	Name        string  `json:"name"`
	Phone       string  `json:"phone"`
	Address     string  `json:"address"`
	DebtBalance float64 `json:"debt_balance"`
	TotalSpend  float64 `json:"total_spend"`
	TxCount     int     `json:"tx_count"`
	IsDeleted   int     `json:"is_deleted,omitempty"`
	CreatedAt   string  `json:"created_at"`
	UpdatedAt   string  `json:"updated_at"`
}

type CustomerRequest struct {
	Name    string `json:"name"`
	Phone   string `json:"phone"`
	Address string `json:"address"`
}

type DebtPayment struct {
	ID            int64   `json:"id"`
	CustomerID    int64   `json:"customer_id"`
	CustomerName  string  `json:"customer_name,omitempty"`
	TransactionID int64   `json:"transaction_id,omitempty"`
	InvoiceNumber string  `json:"invoice_number,omitempty"`
	Amount        float64 `json:"amount"`
	Type          string  `json:"type"` // debt | payment
	Note          string  `json:"note"`
	BalanceAfter  float64 `json:"balance_after"`
	CreatedAt     string  `json:"created_at"`
	CreatedBy     int64   `json:"created_by,omitempty"`
}

type DebtPaymentRequest struct {
	CustomerID int64   `json:"customer_id"`
	Amount     float64 `json:"amount"`
	Note       string  `json:"note"`
}

// ── Penting #6: Supplier ──────────────────────────────────────────────────────
type Supplier struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Phone       string `json:"phone"`
	Address     string `json:"address"`
	ContactName string `json:"contact_name"`
	IsDeleted   int    `json:"is_deleted,omitempty"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

type SupplierRequest struct {
	Name        string `json:"name"`
	Phone       string `json:"phone"`
	Address     string `json:"address"`
	ContactName string `json:"contact_name"`
}

// ── Penting #7: Import Produk CSV ─────────────────────────────────────────────
type ImportResult struct {
	Total   int      `json:"total"`
	Success int      `json:"success"`
	Failed  int      `json:"failed"`
	Errors  []string `json:"errors"`
}

// ── Extended checkout for customer + credit ───────────────────────────────────
type CheckoutRequestV3 struct {
	Items         []CheckoutItem `json:"items"`
	PaymentAmount float64        `json:"payment_amount"`
	PaymentMethod string         `json:"payment_method"`
	CashAmount    float64        `json:"cash_amount"`
	QRISAmount    float64        `json:"qris_amount"`
	DiscountCode  string         `json:"discount_code"`
	CustomerID    int64          `json:"customer_id"`
	OnCredit      bool           `json:"on_credit"` // bayar nanti (hutang)
}
