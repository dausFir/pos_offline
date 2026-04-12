# Kasir & Manajemen Gudang UMKM

Aplikasi kasir offline-first untuk UMKM. Berjalan 100% di jaringan lokal tanpa internet.

## Fitur Utama

- **POS / Kasir**: Layar kasir mobile-friendly, keranjang belanja, pembayaran Tunai & QRIS
- **Scan Barcode**: Input barcode manual atau scanner USB/Bluetooth
- **Manajemen Produk**: CRUD produk dengan harga beli/jual, stok, margin otomatis
- **Riwayat Transaksi**: Filter per tanggal, detail per transaksi
- **RBAC**: 3 level akses (Super Admin, Admin, Kasir)
- **Multi-device**: Kasir bisa akses dari HP via WiFi lokal
- **Offline-first**: 100% tanpa internet, database SQLite lokal
- **Auto-deploy**: 1 file .exe, browser buka otomatis

## Tech Stack

- **Backend**: Go (Golang) + Gorilla Mux + SQLite
- **Frontend**: React.js + Vite (embedded via go:embed)
- **Database**: SQLite (file `database.sqlite`)
- **Auth**: JWT Token

## Cara Build

### Prasyarat
- [Go 1.21+](https://golang.org/dl/) — wajib ada GCC/MinGW untuk CGO (sqlite3)
- [Node.js 18+](https://nodejs.org/)
- Windows: Install [TDM-GCC](https://jmeubank.github.io/tdm-gcc/) agar CGO bisa jalan

### Build di Windows
```bat
build.bat
```

### Build di Linux/Mac
```bash
make build-linux
```

### Development Mode
```bash
# Terminal 1: Backend
go run main.go

# Terminal 2: Frontend (hot reload)
cd frontend && npm run dev
# Frontend dev: http://localhost:3000
# API proxy ke: http://localhost:8080
```

## ⚠️ Keamanan & Produksi

**PENTING**: Sebelum deploy ke produksi, wajib set environment variable:

```bash
# Linux/Mac
export JWT_SECRET="your-super-secure-secret-key-minimum-32-characters"

# Windows
set JWT_SECRET=your-super-secure-secret-key-minimum-32-characters

# Generate secure key dengan OpenSSL
openssl rand -base64 48
```

Copy [.env.example](.env.example) ke `.env` dan isi value yang sesuai.

**Checklist Produksi**:
- ✅ Set `JWT_SECRET` environment variable 
- ✅ Backup database secara berkala
- ✅ Test di network lokal sebelum go-live
- ✅ Update password default admin

## Cara Pakai

1. Double-click `kasir-umkm.exe`
2. Browser PC terbuka otomatis ke `http://localhost:8080`
3. Login: `admin` / `admin123`
4. **Dari HP**: Buka browser HP → ketik `http://192.168.x.x:8080` (IP muncul di terminal)
5. Pastikan HP & PC di WiFi/hotspot yang sama

## Struktur File

```
kasir-umkm/
├── main.go                    # Entry point, server, IP detection
├── go.mod / go.sum
├── build.bat                  # Build script Windows
├── Makefile                   # Build script Linux/Mac
├── database.sqlite            # Auto-created saat pertama run
├── internal/
│   ├── database/database.go   # Init SQLite, schema, seed
│   ├── models/models.go       # Struct data
│   ├── middleware/auth.go     # JWT + CORS middleware
│   └── handlers/
│       ├── auth.go            # Login endpoint
│       ├── products.go        # CRUD produk
│       ├── transactions.go    # Checkout + riwayat
│       └── users.go           # Manajemen user
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── Login.jsx
    │   │   ├── POS.jsx        # Layar kasir utama
    │   │   ├── Dashboard.jsx
    │   │   ├── Products.jsx
    │   │   ├── Transactions.jsx
    │   │   └── Users.jsx
    │   ├── components/Layout.jsx
    │   ├── context/AuthContext.jsx
    │   └── utils/api.js
    └── dist/                  # Output build (auto-embed ke .exe)
```

## API Endpoints

| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| POST | `/api/login` | ❌ | Login, dapat JWT token |
| GET | `/api/me` | ✅ | Info user login |
| GET | `/api/products` | ✅ | List produk (search, pagination) |
| GET | `/api/products/barcode/:barcode` | ✅ | Cari by barcode |
| POST | `/api/products` | admin+ | Tambah produk |
| PUT | `/api/products/:id` | admin+ | Update produk |
| DELETE | `/api/products/:id` | admin+ | Hapus produk |
| POST | `/api/checkout` | ✅ | Proses transaksi |
| GET | `/api/transactions` | admin+ | Riwayat transaksi |
| GET | `/api/transactions/:id` | admin+ | Detail transaksi |
| GET | `/api/dashboard/stats` | admin+ | Statistik dashboard |
| GET | `/api/users` | super_admin | List user |
| POST | `/api/users` | super_admin | Tambah user |
| DELETE | `/api/users?id=X` | super_admin | Hapus user |

## Keamanan

- Semua endpoint (kecuali `/api/login`) memerlukan Bearer JWT Token
- Password di-hash dengan bcrypt
- CORS allow-all untuk akses dari HP di LAN
- Backend validasi ulang semua harga (tidak percaya input frontend)
- Stok di-lock per transaksi, tidak bisa oversell

## Ganti Password Default

Setelah pertama login, segera ganti password via menu Pengguna atau hapus & buat ulang akun.

## Notes untuk Production

1. Ganti `JWTSecret` di `middleware/auth.go` dengan string acak yang kuat
2. Backup file `database.sqlite` secara berkala
3. Gunakan firewall Windows untuk batasi akses ke port 8080 hanya dari jaringan lokal
