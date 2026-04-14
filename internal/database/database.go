package database

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
)

var DB *sql.DB

const AppVersion = "3.0.0"

func Init(dbPath string) error {
	var err error
	DB, err = sql.Open("sqlite3", dbPath+"?_journal_mode=WAL&_foreign_keys=on&_busy_timeout=10000")
	if err != nil {
		return err
	}
	// Improve connection pooling for better performance
	DB.SetMaxOpenConns(10)   // Allow up to 10 concurrent connections
	DB.SetMaxIdleConns(5)    // Keep 5 idle connections ready
	DB.SetConnMaxLifetime(0) // No connection lifetime limit

	if err = DB.Ping(); err != nil {
		return err
	}

	// Performance tuning
	for _, pragma := range []string{
		"PRAGMA cache_size=-16000",
		"PRAGMA temp_store=MEMORY",
		"PRAGMA synchronous=NORMAL",
		"PRAGMA busy_timeout=5000",
		"PRAGMA mmap_size=67108864",
	} {
		DB.Exec(pragma)
	}
	log.Println("🔧 Creating tables...")
	if err = createTables(); err != nil {
		return err
	}
	log.Println("🔧 Running migrations...")
	if err = runMigrations(); err != nil {
		return err
	}
	log.Println("🔧 Creating important tables...")
	if err = createImportantTables(); err != nil {
		return err
	}
	log.Println("🔧 Running important migrations...")
	if err = runImportantMigrations(); err != nil {
		return err
	}
	log.Println("🔧 Seeding super admin...")
	if err = seedSuperAdmin(); err != nil {
		return err
	}
	log.Println("🔧 Initializing trial settings...")
	if err = initializeTrialSettings(); err != nil {
		return err
	}

	SetSetting("app_version", AppVersion)
	SetSetting("db_init_at", time.Now().Format(time.RFC3339))

	log.Printf("✅ Database siap (v%s)", AppVersion)
	return nil
}

func createTables() error {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id             INTEGER  PRIMARY KEY AUTOINCREMENT,
		username       TEXT     NOT NULL UNIQUE,
		password_hash  TEXT     NOT NULL,
		role           TEXT     NOT NULL CHECK(role IN ('super_admin','admin','cashier')),
		is_deleted     INTEGER  NOT NULL DEFAULT 0,
		version        INTEGER  NOT NULL DEFAULT 1,
		created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		created_by     INTEGER  REFERENCES users(id),
		updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_by     INTEGER  REFERENCES users(id),
		deleted_at     DATETIME,
		deleted_by     INTEGER  REFERENCES users(id)
	);

	-- ── Kritical #3: Kategori Produk ─────────────────────────────────────────────
	CREATE TABLE IF NOT EXISTS categories (
		id          INTEGER  PRIMARY KEY AUTOINCREMENT,
		name        TEXT     NOT NULL UNIQUE,
		description TEXT     NOT NULL DEFAULT '',
		color       TEXT     NOT NULL DEFAULT '#005cbb',
		is_deleted  INTEGER  NOT NULL DEFAULT 0,
		version     INTEGER  NOT NULL DEFAULT 1,
		created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		created_by  INTEGER  REFERENCES users(id),
		updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_by  INTEGER  REFERENCES users(id)
	);

	CREATE TABLE IF NOT EXISTS products (
		id              INTEGER  PRIMARY KEY AUTOINCREMENT,
		barcode_sku     TEXT     NOT NULL UNIQUE,
		name            TEXT     NOT NULL,
		category_id     INTEGER  REFERENCES categories(id),
		buy_price       REAL     NOT NULL DEFAULT 0,
		sell_price      REAL     NOT NULL DEFAULT 0,
		stock           INTEGER  NOT NULL DEFAULT 0,
		stock_min       INTEGER  NOT NULL DEFAULT 5,
		is_deleted      INTEGER  NOT NULL DEFAULT 0,
		version         INTEGER  NOT NULL DEFAULT 1,
		created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		created_by      INTEGER  REFERENCES users(id),
		updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_by      INTEGER  REFERENCES users(id),
		deleted_at      DATETIME,
		deleted_by      INTEGER  REFERENCES users(id)
	);

	CREATE TABLE IF NOT EXISTS transactions (
		id              INTEGER  PRIMARY KEY AUTOINCREMENT,
		invoice_number  TEXT     NOT NULL UNIQUE,
		user_id         INTEGER  NOT NULL REFERENCES users(id),
		total_amount    REAL     NOT NULL,
		payment_amount  REAL     NOT NULL,
		change_amount   REAL     NOT NULL,
		payment_method  TEXT     NOT NULL CHECK(payment_method IN ('cash','qris','split','gopay','ovo','dana','linkaja','shopeepay')),
		cash_amount     REAL     NOT NULL DEFAULT 0,
		qris_amount     REAL     NOT NULL DEFAULT 0,
		discount_code   TEXT     NOT NULL DEFAULT '',
		discount_amount REAL     NOT NULL DEFAULT 0,
		status          TEXT     NOT NULL DEFAULT 'completed' CHECK(status IN ('completed','cancelled')),
		cancel_reason   TEXT     NOT NULL DEFAULT '',
		is_deleted      INTEGER  NOT NULL DEFAULT 0,
		version         INTEGER  NOT NULL DEFAULT 1,
		created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		created_by      INTEGER  REFERENCES users(id),
		updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_by      INTEGER  REFERENCES users(id),
		deleted_at      DATETIME,
		deleted_by      INTEGER  REFERENCES users(id)
	);

	CREATE TABLE IF NOT EXISTS transaction_details (
		id              INTEGER  PRIMARY KEY AUTOINCREMENT,
		transaction_id  INTEGER  NOT NULL REFERENCES transactions(id),
		product_id      INTEGER  NOT NULL REFERENCES products(id),
		product_name    TEXT     NOT NULL DEFAULT '',
		category_name   TEXT     NOT NULL DEFAULT '',
		quantity        INTEGER  NOT NULL,
		unit_price      REAL     NOT NULL,
		buy_price       REAL     NOT NULL DEFAULT 0,
		subtotal        REAL     NOT NULL,
		created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS stock_mutations (
		id           INTEGER  PRIMARY KEY AUTOINCREMENT,
		product_id   INTEGER  NOT NULL REFERENCES products(id),
		type         TEXT     NOT NULL CHECK(type IN ('in','out','adjustment','sale','cancel')),
		quantity     INTEGER  NOT NULL,
		stock_before INTEGER  NOT NULL,
		stock_after  INTEGER  NOT NULL,
		note         TEXT     NOT NULL DEFAULT '',
		ref_id       INTEGER,
		user_id      INTEGER  NOT NULL REFERENCES users(id),
		created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS discounts (
		id             INTEGER  PRIMARY KEY AUTOINCREMENT,
		code           TEXT     NOT NULL UNIQUE,
		name           TEXT     NOT NULL,
		type           TEXT     NOT NULL CHECK(type IN ('percent','fixed')),
		value          REAL     NOT NULL,
		min_purchase   REAL     NOT NULL DEFAULT 0,
		is_active      INTEGER  NOT NULL DEFAULT 1,
		is_deleted     INTEGER  NOT NULL DEFAULT 0,
		version        INTEGER  NOT NULL DEFAULT 1,
		created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		created_by     INTEGER  REFERENCES users(id),
		updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_by     INTEGER  REFERENCES users(id),
		deleted_at     DATETIME,
		deleted_by     INTEGER  REFERENCES users(id)
	);

	-- ── Kritis #7: Login Audit Log ────────────────────────────────────────────────
	CREATE TABLE IF NOT EXISTS login_logs (
		id         INTEGER  PRIMARY KEY AUTOINCREMENT,
		user_id    INTEGER  REFERENCES users(id),
		username   TEXT     NOT NULL,
		ip_address TEXT     NOT NULL DEFAULT '',
		user_agent TEXT     NOT NULL DEFAULT '',
		status     TEXT     NOT NULL CHECK(status IN ('success','failed')),
		reason     TEXT     NOT NULL DEFAULT '',
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS app_settings (
		key        TEXT     PRIMARY KEY,
		value      TEXT     NOT NULL,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_by INTEGER  REFERENCES users(id)
	);

	-- Indexes
	CREATE INDEX IF NOT EXISTS idx_products_barcode    ON products(barcode_sku)        WHERE is_deleted=0;
	CREATE INDEX IF NOT EXISTS idx_products_category   ON products(category_id)        WHERE is_deleted=0;
	CREATE INDEX IF NOT EXISTS idx_products_low_stock  ON products(stock, stock_min)   WHERE is_deleted=0;
	CREATE INDEX IF NOT EXISTS idx_transactions_inv    ON transactions(invoice_number);
	CREATE INDEX IF NOT EXISTS idx_transactions_dt     ON transactions(created_at);
	CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
	CREATE INDEX IF NOT EXISTS idx_tx_details_tx       ON transaction_details(transaction_id);
	CREATE INDEX IF NOT EXISTS idx_mutations_product   ON stock_mutations(product_id);
	CREATE INDEX IF NOT EXISTS idx_mutations_dt        ON stock_mutations(created_at);
	CREATE INDEX IF NOT EXISTS idx_login_logs_user     ON login_logs(user_id);
	CREATE INDEX IF NOT EXISTS idx_login_logs_dt       ON login_logs(created_at);

	-- Performance indexes for common queries
	-- Note: customer_id index moved to runImportantMigrations
	CREATE INDEX IF NOT EXISTS idx_transactions_user      ON transactions(user_id);
	CREATE INDEX IF NOT EXISTS idx_transactions_date      ON transactions(created_at, status);
	CREATE INDEX IF NOT EXISTS idx_tx_details_product     ON transaction_details(product_id);
	CREATE INDEX IF NOT EXISTS idx_products_stock         ON products(stock, stock_min) WHERE is_deleted=0;
	-- Note: customers indexes are in createImportantTables
	`
	_, err := DB.Exec(schema)
	return err
}

func runMigrations() error {
	stmts := []string{
		// categories
		`ALTER TABLE products ADD COLUMN category_id INTEGER REFERENCES categories(id)`,
		`ALTER TABLE products ADD COLUMN stock_min INTEGER NOT NULL DEFAULT 5`,
		// products audit
		`ALTER TABLE products ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE products ADD COLUMN version INTEGER NOT NULL DEFAULT 1`,
		`ALTER TABLE products ADD COLUMN created_by INTEGER REFERENCES users(id)`,
		`ALTER TABLE products ADD COLUMN updated_by INTEGER REFERENCES users(id)`,
		`ALTER TABLE products ADD COLUMN deleted_at DATETIME`,
		`ALTER TABLE products ADD COLUMN deleted_by INTEGER REFERENCES users(id)`,
		// transactions
		`ALTER TABLE transactions ADD COLUMN status TEXT NOT NULL DEFAULT 'completed'`,
		`ALTER TABLE transactions ADD COLUMN cancel_reason TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE transactions ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE transactions ADD COLUMN version INTEGER NOT NULL DEFAULT 1`,
		`ALTER TABLE transactions ADD COLUMN created_by INTEGER REFERENCES users(id)`,
		`ALTER TABLE transactions ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`,
		`ALTER TABLE transactions ADD COLUMN updated_by INTEGER REFERENCES users(id)`,
		`ALTER TABLE transactions ADD COLUMN deleted_at DATETIME`,
		`ALTER TABLE transactions ADD COLUMN deleted_by INTEGER REFERENCES users(id)`,
		`ALTER TABLE transactions ADD COLUMN discount_code TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE transactions ADD COLUMN discount_amount REAL NOT NULL DEFAULT 0`,
		// split payment
		`ALTER TABLE transactions ADD COLUMN cash_amount REAL NOT NULL DEFAULT 0`,
		`ALTER TABLE transactions ADD COLUMN qris_amount REAL NOT NULL DEFAULT 0`,
		// users audit
		`ALTER TABLE users ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE users ADD COLUMN version INTEGER NOT NULL DEFAULT 1`,
		`ALTER TABLE users ADD COLUMN created_by INTEGER REFERENCES users(id)`,
		`ALTER TABLE users ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`,
		`ALTER TABLE users ADD COLUMN updated_by INTEGER REFERENCES users(id)`,
		`ALTER TABLE users ADD COLUMN deleted_at DATETIME`,
		`ALTER TABLE users ADD COLUMN deleted_by INTEGER REFERENCES users(id)`,
		// transaction_details snapshots
		`ALTER TABLE transaction_details ADD COLUMN product_name TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE transaction_details ADD COLUMN category_name TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE transaction_details ADD COLUMN buy_price REAL NOT NULL DEFAULT 0`,
		`ALTER TABLE transaction_details ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`,
		// discounts audit
		`ALTER TABLE discounts ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE discounts ADD COLUMN version INTEGER NOT NULL DEFAULT 1`,
		`ALTER TABLE discounts ADD COLUMN created_by INTEGER REFERENCES users(id)`,
		`ALTER TABLE discounts ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`,
		`ALTER TABLE discounts ADD COLUMN updated_by INTEGER REFERENCES users(id)`,
		`ALTER TABLE discounts ADD COLUMN deleted_at DATETIME`,
		`ALTER TABLE discounts ADD COLUMN deleted_by INTEGER REFERENCES users(id)`,
		// stock_mutations ref_id
		`ALTER TABLE stock_mutations ADD COLUMN ref_id INTEGER`,
		// e-wallet payment support
		`ALTER TABLE transactions ADD COLUMN ewallet_amount REAL NOT NULL DEFAULT 0`,
		`ALTER TABLE transactions ADD COLUMN ewallet_provider TEXT NOT NULL DEFAULT ''`,
	}
	for _, s := range stmts {
		DB.Exec(s) // ignore duplicate-column errors
	}
	return nil
}

func seedSuperAdmin() error {
	var count int
	DB.QueryRow("SELECT COUNT(*) FROM users WHERE username='admin' AND is_deleted=0").Scan(&count)
	if count > 0 {
		return nil
	}
	hash, err := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	now := time.Now()
	_, err = DB.Exec(
		`INSERT INTO users (username, password_hash, role, version, created_at, updated_at) VALUES (?,?,?,1,?,?)`,
		"admin", string(hash), "super_admin", now, now,
	)
	if err != nil {
		return err
	}
	log.Println("🌱 Akun super_admin dibuat: admin / admin123")
	return nil
}

func GetSetting(key, defaultVal string) string {
	var val string
	if err := DB.QueryRow("SELECT value FROM app_settings WHERE key=?", key).Scan(&val); err != nil {
		return defaultVal
	}
	return val
}

func SetSetting(key, value string) error {
	_, err := DB.Exec(
		`INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP)
		 ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`,
		key, value,
	)
	return err
}

// GenerateInvoiceNumber creates a unique invoice number using sequence counter
func GenerateInvoiceNumber() (string, error) {
	now := time.Now()
	dateKey := now.Format("20060102")

	tx, err := DB.Begin()
	if err != nil {
		return "", err
	}
	defer tx.Rollback()

	// Get or create sequence for today
	var lastSeq int64
	err = tx.QueryRow("SELECT last_seq FROM invoice_sequence WHERE date_key = ?", dateKey).Scan(&lastSeq)
	if err != nil {
		// First invoice today
		_, err = tx.Exec("INSERT INTO invoice_sequence (date_key, last_seq) VALUES (?, 1)", dateKey)
		if err != nil {
			return "", err
		}
		lastSeq = 1
	} else {
		// Increment sequence
		lastSeq++
		_, err = tx.Exec("UPDATE invoice_sequence SET last_seq = ? WHERE date_key = ?", lastSeq, dateKey)
		if err != nil {
			return "", err
		}
	}

	if err = tx.Commit(); err != nil {
		return "", err
	}

	return fmt.Sprintf("INV-%s-%05d", dateKey, lastSeq), nil
}

// GenerateInvoiceNumberWithTx creates invoice number using existing transaction
func GenerateInvoiceNumberWithTx(tx *sql.Tx) (string, error) {
	now := time.Now()
	dateKey := now.Format("20060102")

	// Get or create sequence for today
	var lastSeq int64
	err := tx.QueryRow("SELECT last_seq FROM invoice_sequence WHERE date_key = ?", dateKey).Scan(&lastSeq)
	if err != nil {
		// First invoice today
		_, err = tx.Exec("INSERT INTO invoice_sequence (date_key, last_seq) VALUES (?, 1)", dateKey)
		if err != nil {
			return "", err
		}
		lastSeq = 1
	} else {
		// Increment sequence
		lastSeq++
		_, err = tx.Exec("UPDATE invoice_sequence SET last_seq = ? WHERE date_key = ?", lastSeq, dateKey)
		if err != nil {
			return "", err
		}
	}

	return fmt.Sprintf("INV-%s-%05d", dateKey, lastSeq), nil
}

func NullInt64(v int64) sql.NullInt64 {
	if v == 0 {
		return sql.NullInt64{}
	}
	return sql.NullInt64{Int64: v, Valid: true}
}

func NullTime(t time.Time) sql.NullTime {
	if t.IsZero() {
		return sql.NullTime{}
	}
	return sql.NullTime{Time: t, Valid: true}
}

func createImportantTables() error {
	schema := `
	-- Penting #3: Harga Grosir/Member per produk
	CREATE TABLE IF NOT EXISTS price_tiers (
		id         INTEGER  PRIMARY KEY AUTOINCREMENT,
		product_id INTEGER  NOT NULL REFERENCES products(id),
		label      TEXT     NOT NULL DEFAULT 'Grosir',
		min_qty    INTEGER  NOT NULL DEFAULT 1,
		price      REAL     NOT NULL,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS idx_price_tiers_product ON price_tiers(product_id);

	-- Penting #5: Data Pelanggan
	CREATE TABLE IF NOT EXISTS customers (
		id           INTEGER  PRIMARY KEY AUTOINCREMENT,
		name         TEXT     NOT NULL,
		phone        TEXT     NOT NULL DEFAULT '',
		address      TEXT     NOT NULL DEFAULT '',
		debt_balance REAL     NOT NULL DEFAULT 0,
		is_deleted   INTEGER  NOT NULL DEFAULT 0,
		created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS idx_customers_name    ON customers(name)  WHERE is_deleted=0;
	CREATE INDEX IF NOT EXISTS idx_customers_phone   ON customers(phone) WHERE is_deleted=0;
	CREATE INDEX IF NOT EXISTS idx_customers_deleted ON customers(is_deleted, name);

	-- Penting #5: Riwayat Hutang/Bayar
	CREATE TABLE IF NOT EXISTS debt_ledger (
		id             INTEGER  PRIMARY KEY AUTOINCREMENT,
		customer_id    INTEGER  NOT NULL REFERENCES customers(id),
		transaction_id INTEGER  REFERENCES transactions(id),
		invoice_number TEXT     NOT NULL DEFAULT '',
		amount         REAL     NOT NULL,
		type           TEXT     NOT NULL CHECK(type IN ('debt','payment')),
		note           TEXT     NOT NULL DEFAULT '',
		balance_after  REAL     NOT NULL DEFAULT 0,
		created_by     INTEGER  REFERENCES users(id),
		created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS idx_debt_customer ON debt_ledger(customer_id);
	CREATE INDEX IF NOT EXISTS idx_debt_dt       ON debt_ledger(created_at);

	-- Penting #6: Supplier
	CREATE TABLE IF NOT EXISTS suppliers (
		id           INTEGER  PRIMARY KEY AUTOINCREMENT,
		name         TEXT     NOT NULL,
		phone        TEXT     NOT NULL DEFAULT '',
		address      TEXT     NOT NULL DEFAULT '',
		contact_name TEXT     NOT NULL DEFAULT '',
		is_deleted   INTEGER  NOT NULL DEFAULT 0,
		created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name) WHERE is_deleted=0;

	-- Riwayat perubahan harga produk
	CREATE TABLE IF NOT EXISTS price_history (
		id          INTEGER  PRIMARY KEY AUTOINCREMENT,
		product_id  INTEGER  NOT NULL REFERENCES products(id),
		old_buy     REAL     NOT NULL DEFAULT 0,
		new_buy     REAL     NOT NULL DEFAULT 0,
		old_sell    REAL     NOT NULL DEFAULT 0,
		new_sell    REAL     NOT NULL DEFAULT 0,
		changed_by  INTEGER  REFERENCES users(id),
		note        TEXT     NOT NULL DEFAULT '',
		created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history(product_id);

	-- Add customer_id + on_credit to transactions

	-- Invoice sequence for unique numbering
	CREATE TABLE IF NOT EXISTS invoice_sequence (
		date_key TEXT PRIMARY KEY,
		last_seq INTEGER NOT NULL DEFAULT 0
	);

	-- Sessions table for refresh token management
	CREATE TABLE IF NOT EXISTS sessions (
		id                    INTEGER  PRIMARY KEY AUTOINCREMENT,
		user_id              INTEGER  NOT NULL REFERENCES users(id),
		refresh_token_hash   TEXT     NOT NULL UNIQUE,
		device_info          TEXT     NOT NULL DEFAULT '',
		ip_address           TEXT     NOT NULL DEFAULT '',
		expires_at           DATETIME NOT NULL,
		last_activity        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS idx_sessions_user_id        ON sessions(user_id);
	CREATE INDEX IF NOT EXISTS idx_sessions_token_hash     ON sessions(refresh_token_hash);
	CREATE INDEX IF NOT EXISTS idx_sessions_expires        ON sessions(expires_at);
	`
	_, err := DB.Exec(schema)
	return err
}

func runImportantMigrations() error {
	stmts := []string{
		`ALTER TABLE transactions ADD COLUMN customer_id INTEGER REFERENCES customers(id)`,
		`ALTER TABLE transactions ADD COLUMN on_credit INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE transactions ADD COLUMN ppn_amount REAL NOT NULL DEFAULT 0`,
		`ALTER TABLE products ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id)`,
		`CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id) WHERE customer_id IS NOT NULL`,
	}
	for _, s := range stmts {
		DB.Exec(s)
	}
	return nil
}

// Initialize trial settings on first run
func initializeTrialSettings() error {
	// Check if trial already initialized
	if GetSetting("trial_initialized", "") != "" {
		return nil // Already initialized
	}

	now := time.Now()
	expiresAt := now.AddDate(0, 0, 7) // 7 days from now

	settings := map[string]string{
		"is_trial_version":  "true",
		"trial_start_date":  now.Format("2006-01-02 15:04:05"),
		"trial_expires_at":  expiresAt.Format("2006-01-02 15:04:05"),
		"max_products":      "20",
		"trial_initialized": "true",
	}

	for key, value := range settings {
		if err := SetSetting(key, value); err != nil {
			return err
		}
	}

	return nil
}
