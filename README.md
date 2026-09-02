# Kasir & Manajemen Gudang UMKM v3.4

Aplikasi kasir offline-first untuk UMKM. Berjalan 100% di jaringan lokal tanpa internet.

## ✨ Fitur Utama

### 🏪 **Point of Sale (POS)**
- **Kasir Mobile-Optimized**: Interface responsive untuk HP & tablet
- **Scan Barcode Multi-Method**: Manual input, USB scanner, atau webcam/camera HP
- **Keranjang Belanja**: Add/remove items, quick quantity update
- **Metode Pembayaran**: Tunai, QRIS, Transfer Bank
- **Hot Keys**: F1-F4 shortcuts untuk workflow kasir cepat
- **Receipt Printing**: Thermal printer support + preview

### 📦 **Manajemen Produk & Stok**
- **CRUD Produk Lengkap**: Nama, kategori, harga beli/jual, stok, barcode/SKU
- **Auto-Calculate Margin**: Perhitungan margin & profit otomatis
- **Stock Mutation Tracking**: Log real-time setiap perubahan stok
- **Bulk Import**: Excel/CSV import dengan template
- **Low Stock Alerts**: Warning otomatis stok menipis
- **Kategori Management**: Organisir produk per kategori

### 💰 **Sistem Keuangan & Pajak**
- **PPN Management**: Mode inclusive/exclusive dengan perhitungan otomatis  
- **Discount System**: Kode diskon dengan persentase atau nominal
- **Multi-Payment Methods**: Tunai, QRIS, transfer dengan tracking terpisah
- **Advanced Receipts**: PPN breakdown, discount display, custom logo toko
- **Financial Reports**: Daily/monthly profit & revenue analysis

### 📊 **Reporting & Analytics**
- **Dashboard Overview**: Real-time stats, grafik penjualan, profit tracking
- **Transaction History**: Filter tanggal, search, pagination
- **CSV Export**: Export transaksi, produk, stock mutations untuk Excel/Google Sheets  
- **Shift Reports**: Laporan per shift kerja kasir
- **Profit Analysis**: Gross profit, margin, HPP breakdown

### 👥 **Multi-User & Security**
- **3-Tier RBAC**: Super Admin, Admin, Kasir dengan permission berbeda
- **JWT Authentication**: Secure token-based auth dengan refresh mechanism
- **Activity Logging**: Track login attempts & user activities  
- **Session Management**: Auto logout, concurrent session control
- **Environment-Based Security**: Production-ready configuration

### 🌐 **Multi-Device & Network**
- **Offline-First**: Berjalan tanpa internet, data tersimpan lokal SQLite
- **Cross-Device Access**: Kasir akses dari HP via WiFi yang sama
- **Real-Time Sync**: Data sinkron real-time antar device di LAN
- **Auto Network Detection**: Otomatis detect IP untuk akses mobile
- **Browser Compatible**: Chrome, Firefox, Safari, Edge support

## 🛠️ Tech Stack

- **Backend**: Go 1.21+ with Gorilla Mux router
- **Database**: SQLite with WAL mode for concurrent access
- **Frontend**: React 18 + Vite (embedded via go:embed)
- **Authentication**: JWT + Refresh Token system
- **Styling**: CSS3 with Material Design 3 inspired components
- **Architecture**: Offline-first, single binary deployment
- **Network**: Local network only, no internet dependency

## 🚀 Quick Start

### 1️⃣ Download & Run (Recommended)
```bash
# Download latest release dari GitHub
# Double-click kasir-umkm.exe (Windows) atau ./kasir-umkm (Linux/Mac)
# Browser otomatis buka ke http://localhost:8080
```

### 2️⃣ Development Setup

### 2️⃣ Development Setup

**Prerequisites:**
- [Go 1.21+](https://golang.org/dl/) dengan CGO enabled (untuk SQLite)
- [Node.js 18+](https://nodejs.org/) untuk build frontend
- **Windows**: Install [TDM-GCC](https://jmeubank.github.io/tdm-gcc/) atau MinGW
- **macOS**: `xcode-select --install`
- **Linux**: `sudo apt install build-essential` atau equivalent

**Development Mode:**
```bash
# Clone & setup
git clone <repository-url>
cd kasir-umkm_v3.4

# Install frontend dependencies
cd frontend && npm install && cd ..

# Run development server
export JWT_SECRET="development-secret-key-minimum-32-characters"
export INITIAL_ADMIN_PASSWORD="ganti-dengan-password-admin-yang-kuat"
go run main.go

# Untuk hot reload frontend (optional, terminal terpisah):
cd frontend && npm run dev
```

**Build Production:**
```bash
# Windows
build.bat

# Linux/Mac
make build

# Cross compile untuk platform lain
GOOS=linux GOARCH=amd64 go build -o kasir-umkm-linux
GOOS=windows GOARCH=amd64 go build -o kasir-umkm.exe
```

## 🔐 Keamanan & Konfigurasi Produksi

### Environment Variables (WAJIB untuk Produksi!)

```bash
# Linux/Mac
export JWT_SECRET="your-super-secure-secret-key-minimum-32-characters"

# Windows Command Prompt
set JWT_SECRET=your-super-secure-secret-key-minimum-32-characters

# Windows PowerShell  
$env:JWT_SECRET="your-super-secure-secret-key-minimum-32-characters"

# Generate secure key
openssl rand -base64 48
# atau
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

**⚠️ CRITICAL**: Jangan gunakan hardcoded secret di production! Sistem akan otomatis fallback ke default hanya untuk development.

### Checklist Keamanan Produksi
- ✅ **Set JWT_SECRET** environment variable (minimum 32 karakter)
- ✅ **Set AUDIT_HMAC_KEY** terpisah (minimum 32 karakter) untuk melindungi rantai audit.
- ✅ **Set `INITIAL_ADMIN_PASSWORD`** saat membuat database baru.
- ✅ **Firewall setup**: Batasi akses port 8080 hanya dari LAN
- ✅ **Database backup**: Backup rutin file `database.sqlite`
- ✅ **Network isolation**: Jangan expose ke internet public
- ✅ **User management**: Hapus user yang tidak diperlukan
- ✅ **Receipt logo**: Upload logo toko untuk branding profesional

### Network & Device Access

```bash
# Server info di terminal saat startup:
🖥️  PC Server: http://localhost:8080
📱 Mobile Kasir: http://192.168.1.99:8080
```

**Mobile Setup:**
1. Pastikan HP & PC di WiFi yang sama
2. Buka browser HP → masukkan IP dari terminal  
3. Bookmark untuk akses cepat
4. Test scan barcode dari kamera HP
5. Cetak test receipt dari mobile

## 📱 Cara Penggunaan

### Setup Awal
1. **Start Server**: Double-click `kasir-umkm.exe` atau `./kasir-umkm`
2. **Browser Auto-Open**: PC otomatis buka http://localhost:8080
3. **Login Pertama**: username `admin`; password menggunakan `INITIAL_ADMIN_PASSWORD` saat database pertama dibuat.
4. **Mobile Access**: HP ke `http://192.168.x.x:8080` (lihat IP di terminal)

### Workflow Kasir Harian  
1. **Buka Shift**: Login → Menu POS → Mulai transaksi
2. **Input Item**: Scan barcode atau search manual
3. **Tambah/Edit Quantity**: Klik item di cart untuk adjust
4. **Apply Discount**: Input kode diskon jika ada  
5. **Pilih Payment**: Tunai/QRIS/Transfer
6. **Print Receipt**: Auto-print atau preview dulu
7. **Tutup Shift**: Menu Reports → Shift Report

### Hot Keys (Desktop)
- `F1`: Open barcode scanner modal
- `F2`: Clear cart / New transaction  
- `F3`: Hold transaction (simpan sementara)
- `F4`: Resume held transaction
- `ESC`: Close modal / Clear search
- `Enter`: Process barcode input
- `Delete`: Remove last cart item
- `Alt + 1-4`: Quick payment amounts

## 📁 Struktur Project

```
kasir-umkm_v3.4/
├── main.go                         # Server entry point + network detection
├── go.mod / go.sum                 # Go dependencies
├── build.bat / Makefile            # Build scripts
├── database.sqlite                 # SQLite database (auto-created)
├── database.sqlite-wal             # Write-Ahead Log
├── database.sqlite-shm             # Shared Memory
├── migrations/                     # Database schema migrations
├── internal/
│   ├── database/
│   │   └── database.go             # SQLite setup, migrations, seeding
│   ├── models/
│   │   └── models.go               # Data structures & database models
│   ├── middleware/
│   │   └── auth.go                 # JWT auth, CORS, request validation
│   └── handlers/
│       ├── auth.go                 # Login, logout, refresh token
│       ├── products.go             # Product CRUD, barcode search
│       ├── categories.go           # Product categories management
│       ├── transactions.go         # POS checkout, transaction history
│       ├── customers.go            # Customer management
│       ├── suppliers.go            # Supplier management  
│       ├── users.go                # User & role management
│       ├── reports.go              # Dashboard stats, analytics
│       ├── shift.go                # Shift management
│       ├── stock.go                # Stock mutations tracking
│       ├── discounts.go            # Discount codes management
│       ├── settings.go             # App settings, PPN, logo upload
│       ├── export.go               # CSV exports, database backup
│       └── import_products.go      # Bulk product import
└── frontend/
    ├── package.json                # Frontend dependencies
    ├── vite.config.js              # Vite build configuration  
    ├── index.html                  # Main HTML template
    ├── public/
    │   ├── manifest.json           # PWA manifest
    │   ├── sw.js                   # Service worker (offline support)
    │   └── fonts/                  # Material Symbols font
    ├── src/
    │   ├── main.jsx                # React entry point
    │   ├── App.jsx                 # Root component + routing
    │   ├── index.css               # Global styles + Material Design 3
    │   ├── components/
    │   │   ├── Layout.jsx          # Main layout wrapper
    │   │   ├── Icon.jsx            # Material Symbols icon component
    │   │   ├── ServerStatus.jsx    # Network status indicator
    │   │   ├── GlobalSearch.jsx    # Global search functionality
    │   │   └── ThermalReceipt.jsx  # Receipt printing + preview
    │   ├── pages/
    │   │   ├── Login.jsx           # Authentication page
    │   │   ├── POS.jsx             # Main cashier interface
    │   │   ├── Dashboard.jsx       # Admin dashboard + stats
    │   │   ├── Products.jsx        # Product management
    │   │   ├── ImportProducts.jsx  # Bulk product import
    │   │   ├── Transactions.jsx    # Transaction history
    │   │   ├── Customers.jsx       # Customer management
    │   │   ├── Suppliers.jsx       # Supplier management
    │   │   ├── Users.jsx           # User management
    │   │   ├── Reports.jsx         # Financial reports
    │   │   ├── ShiftReport.jsx     # Shift-based reporting
    │   │   ├── StockMutations.jsx  # Stock change tracking
    │   │   ├── Discounts.jsx       # Discount code management
    │   │   ├── Settings.jsx        # App configuration
    │   │   ├── LoginLogs.jsx       # User activity logs
    │   │   └── Profile.jsx         # User profile settings
    │   ├── context/
    │   │   ├── AuthContext.jsx     # Authentication state
    │   │   └── I18nContext.jsx     # Internationalization (ID/EN)
    │   └── utils/
    │       └── api.js              # Axios config + auth interceptors
    └── dist/                       # Build output (embedded in Go binary)
```

## 🌐 API Reference

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/login` | ❌ | Login dengan username/password, return JWT tokens |
| `POST` | `/api/refresh-token` | ❌ | Refresh access token menggunakan refresh token |
| `POST` | `/api/logout` | ✅ | Logout dan invalidate tokens |
| `GET` | `/api/me` | ✅ | Get current user info |

### Products & Inventory  
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/products` | ✅ | List produk dengan search, pagination, filter kategori |
| `GET` | `/api/products/:id` | ✅ | Get detail produk by ID |
| `GET` | `/api/products/barcode/:barcode` | ✅ | Cari produk by barcode/SKU |
| `POST` | `/api/products` | admin+ | Tambah produk baru |
| `PUT` | `/api/products/:id` | admin+ | Update produk existing |  
| `DELETE` | `/api/products/:id` | admin+ | Hapus produk |
| `POST` | `/api/products/import` | admin+ | Bulk import produk dari CSV |
| `GET` | `/api/categories` | ✅ | List kategori produk |
| `POST` | `/api/categories` | admin+ | Tambah kategori baru |

### Point of Sale (POS)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/checkout` | ✅ | Process transaksi POS dengan payment |
| `POST` | `/api/validate-discount` | ✅ | Validasi kode diskon sebelum checkout |
| `GET` | `/api/pos/settings` | ✅ | Get POS settings (PPN, payment methods) |

### Transactions & Finance
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/transactions` | admin+ | List riwayat transaksi dengan filter tanggal |
| `GET` | `/api/transactions/:id` | admin+ | Get detail transaksi by ID |
| `DELETE` | `/api/transactions/:id` | super_admin | Cancel/delete transaksi |
| `GET` | `/api/dashboard/stats` | admin+ | Dashboard statistics & analytics |
| `GET` | `/api/reports/profit` | admin+ | Profit & loss reports by period |
| `GET` | `/api/reports/shift` | admin+ | Shift-based sales reports |

### Stock Management
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/stock/mutations` | admin+ | Stock mutation history dengan filter |
| `POST` | `/api/stock/adjust` | admin+ | Manual stock adjustment |
| `GET` | `/api/stock/low` | admin+ | List produk dengan stok rendah |

### Customer & Supplier Management
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/customers` | admin+ | List customer dengan pagination |
| `POST` | `/api/customers` | admin+ | Tambah customer baru |
| `PUT` | `/api/customers/:id` | admin+ | Update customer data |
| `DELETE` | `/api/customers/:id` | admin+ | Hapus customer |
| `GET` | `/api/suppliers` | admin+ | List supplier |
| `POST` | `/api/suppliers` | admin+ | Tambah supplier baru |

### Discount & Promotions  
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/discounts` | admin+ | List semua kode diskon |
| `POST` | `/api/discounts` | admin+ | Buat kode diskon baru |
| `PUT` | `/api/discounts/:id` | admin+ | Update kode diskon |
| `DELETE` | `/api/discounts/:id` | admin+ | Hapus kode diskon |

### User Management
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/users` | super_admin | List semua user |
| `POST` | `/api/users` | super_admin | Tambah user baru |
| `PUT` | `/api/users/:id` | super_admin | Update user data |
| `DELETE` | `/api/users/:id` | super_admin | Hapus user |
| `GET` | `/api/login-logs` | admin+ | User activity & login logs |

### Settings & Configuration
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/settings` | admin+ | Get app settings (PPN, logo, etc) |
| `PUT` | `/api/settings` | admin+ | Update app settings |
| `POST` | `/api/settings/logo` | admin+ | Upload logo toko |
| `DELETE` | `/api/settings/logo` | admin+ | Hapus logo toko |

### Data Export & Backup
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/export/transactions` | admin+ | Export transaksi ke CSV |
| `GET` | `/api/export/products` | admin+ | Export produk ke CSV |
| `GET` | `/api/export/stock-mutations` | admin+ | Export stock mutations ke CSV |
| `POST` | `/api/backup` | super_admin | Download backup database terenkripsi `.posbak` |

### Kontrol Operasional & Keamanan

- **Audit trail hash-chained** mencatat aksi perubahan data, backup/restore, dan export; hanya `super_admin` dapat melihatnya.
- **Backup otomatis opsional**: atur `AUTO_BACKUP_PASSWORD` (minimal 12 karakter), `BACKUP_DIRECTORY`, serta `BACKUP_RETENTION_DAYS`. Aplikasi membuat `.posbak` terenkripsi setiap hari pukul 02:00.
- **Tutup shift kasir**: buka shift dengan kas awal dan tutup dengan kas fisik; aplikasi menghitung kas harapan serta selisih.
- **Login protection**: lima kegagalan login untuk kombinasi IP dan username akan dikunci selama 15 menit.
- **Diagnostik**: `GET /api/diagnostics` untuk super admin memeriksa integritas SQLite, rantai audit, ukuran database, dan backup otomatis terakhir.

### Permission Levels:
- ✅ **All** = Authenticated users (kasir, admin, super_admin)
- **admin+** = Admin & Super Admin only
- **super_admin** = Super Admin only
- ❌ **Public** = No authentication required

## 🔒 Security Architecture

### Authentication & Authorization  
- **JWT + Refresh Token** system dengan automatic token refresh
- **3-Tier RBAC**: `kasir` → `admin` → `super_admin` dengan permission inheritance  
- **bcrypt Password Hashing** dengan salt rounds untuk secure storage
- **Environment-based JWT secrets** - no hardcoded secrets in production
- **Session Management** dengan concurrent session control
- **Auto-logout** pada token expiry dengan graceful re-authentication

### Network & Data Security
- **Local Network Only** - zero internet dependency, no cloud data
- **CORS Configured** untuk allow cross-device access dalam LAN
- **SQLite WAL Mode** untuk concurrent access dengan data consistency
- **Input Validation** di backend untuk semua operations
- **SQL Injection Protection** via parameterized queries
- **Stock Locking** mechanism untuk prevent overselling

### Data Integrity  
- **Transaction Atomicity** - rollback pada failed operations
- **Audit Trail** untuk semua financial transactions
- **Stock Mutation Logs** untuk tracking inventory changes
- **User Activity Logging** untuk security monitoring

## 🚀 Production Deployment Tips

### Performance Optimization
```bash
# Set environment untuk production
export GO_ENV=production
export JWT_SECRET="your-super-secure-key"

# Build optimized binary  
go build -ldflags="-s -w" -o kasir-umkm main.go

# Verify binary
./kasir-umkm
```

### Database Maintenance
```bash  
# Backup database harian
# Gunakan menu Backup aplikasi. File .posbak dienkripsi AES-256-GCM dan
# hanya dapat dipulihkan melalui aplikasi dengan password owner yang sama.

# Check database integrity
echo "PRAGMA integrity_check;" | sqlite3 database.sqlite
```

### Network Configuration
- **Port 8080**: Default server port (configurable via --port flag)
- **Firewall**: Allow port 8080 hanya untuk trusted network range
- **Router**: Set static IP untuk server agar mobile device consistent
- **WiFi**: Use dedicated WiFi network untuk POS operations

### Monitoring & Maintenance  
- **Log Files**: Check console log untuk error patterns
- **Disk Space**: Monitor storage karena SQLite database growth
- **Memory Usage**: Restart server weekly untuk optimal performance
- **User Sessions**: Review login logs untuk unusual activity

## ⚠️ Important Notes

### Requirements & Compatibility
- **Go Version**: Minimum Go 1.21 dengan CGO support
- **Browser**: Modern browsers (Chrome 80+, Firefox 75+, Safari 13+, Edge 80+)
- **Mobile**: iOS 13+, Android 8+ dengan modern browsers
- **Network**: Local Wi-Fi or hotspot shared network
- **Printer**: Thermal receipt printer dengan IP atau USB interface

### Default Credentials (CHANGE IMMEDIATELY!)
```
Username: admin
Password: nilai `INITIAL_ADMIN_PASSWORD` (minimal 12 karakter)
Role: super_admin
```

### File Locations
- **Database**: `./database.sqlite` (+ WAL & SHM files)
- **Uploads**: `./uploads/` (logo images, import files)
- **Logs**: Console output (redirect to file if needed)
- **Config**: Environment variables (no config files)

### Troubleshooting Common Issues
1. **"bind: address already in use"** → `lsof -ti:8080 | xargs kill`
2. **"CGO not enabled"** → Install GCC/MinGW dan enable CGO
3. **"403 Forbidden"** → Check JWT_SECRET environment variable
4. **"Database locked"** → Restart server, check file permissions
5. **Mobile tidak bisa akses** → Check firewall, confirm same network

For advanced configuration and troubleshooting, see the [Wiki](../../wiki) or create an [Issue](../../issues).

---

**📝 Version**: v3.4 | **📅 Updated**: April 2026  
**💼 License**: Proprietary | **👥 Support**: Internal Development Team
