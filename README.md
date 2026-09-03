# Kasir & Manajemen Gudang UMKM

Aplikasi Point of Sale (POS) dan manajemen gudang untuk UMKM yang berjalan **offline-first**. Sistem dipasang sebagai satu binary di PC toko, menyimpan data pada SQLite, dan dapat diakses perangkat lain melalui LAN yang sama.

> Gunakan hanya pada jaringan lokal tepercaya. Jangan membuka port aplikasi ke internet publik.

## Kemampuan Utama

- POS responsif untuk desktop, tablet, dan ponsel; mendukung barcode, diskon, PPN, pembayaran tunai, QRIS, split payment, e-wallet, dan kredit pelanggan.
- Produk, kategori, supplier, pelanggan, stok minimum, mutasi stok, harga bertingkat/grosir, serta impor CSV berbasis job dan chunk.
- Laporan dashboard, laba-rugi, riwayat transaksi, mutasi stok, hutang pelanggan, dan rekonsiliasi shift kasir.
- Role-based access: `cashier`, `admin`, dan `super_admin`.
- Backup terenkripsi `.posbak`, restore tervalidasi, audit trail hash-chained, diagnostik database, dan backup otomatis opsional.

## Arsitektur

```text
Browser POS (React/Vite)
          |
          | HTTP + JWT pada LAN
          v
Go API (Gorilla Mux)
          |
          +-- RBAC, rate limit login, audit middleware
          +-- layanan checkout, impor, backup, shift
          v
SQLite + WAL
          |
          +-- database.sqlite
          +-- audit events, sessions, import jobs, cash shifts
          +-- backup terenkripsi .posbak
```

Backend dan hasil build frontend dibundel dengan `go:embed`, sehingga deployment hanya membutuhkan binary, konfigurasi environment, dan direktori data.

## Role dan Akses

| Fitur | Kasir | Admin | Super Admin |
| --- | :---: | :---: | :---: |
| POS, checkout, buka/tutup shift | Ya | Ya | Ya |
| Lihat produk, kategori, diskon | Ya | Ya | Ya |
| Kelola produk, stok, supplier, pelanggan, diskon | Tidak | Ya | Ya |
| Laporan, transaksi, import CSV | Tidak | Ya | Ya |
| Kelola pengguna, export CSV, backup/restore | Tidak | Tidak | Ya |
| Audit trail dan diagnostik | Tidak | Tidak | Ya |

## Persyaratan

- Go 1.21+ dengan CGO aktif (SQLite driver).
- Node.js 18+ untuk membangun frontend.
- Compiler C: TDM-GCC/MinGW (Windows), Xcode Command Line Tools (macOS), atau `build-essential` (Linux).

## Menjalankan Aplikasi

### Development

```bash
git clone https://github.com/dausFir/pos_offline.git
cd pos_offline
cd frontend && npm install && cd ..

export JWT_SECRET="development-secret-key-minimum-32-characters"
export INITIAL_ADMIN_PASSWORD="ganti-dengan-password-admin-yang-kuat"
go run .
```

Buka `http://localhost:8080`. Untuk akses ponsel, gunakan IP LAN yang dicetak aplikasi saat startup.

### Build Produksi

```bash
cd frontend && npm run build && cd ..
go build -ldflags="-s -w" -o kasir-umkm .
```

Pada Windows, skrip `build.bat` dapat digunakan setelah dependency tersedia.

## Konfigurasi Produksi

Simpan nilai rahasia di environment host atau `.env` yang tidak dikomit.

```env
GO_ENV=production
JWT_SECRET=ganti-dengan-secret-minimal-32-karakter
AUDIT_HMAC_KEY=ganti-dengan-secret-audit-terpisah-minimal-32-karakter
INITIAL_ADMIN_PASSWORD=password-awal-super-admin-minimal-12-karakter

# Opsional: backup otomatis harian pukul 02:00
AUTO_BACKUP_PASSWORD=password-backup-minimal-12-karakter
BACKUP_DIRECTORY=backups
BACKUP_RETENTION_DAYS=14

# Hanya untuk frontend development server terpisah
CORS_ALLOWED_ORIGIN=http://localhost:5173

# Hanya branch/edisi trial-v2: public key Ed25519 milik penerbit lisensi
LICENSE_PUBLIC_KEY=base64-public-key-ed25519
```

`JWT_SECRET`, `AUDIT_HMAC_KEY`, dan `INITIAL_ADMIN_PASSWORD` wajib untuk instalasi production baru. Aplikasi menolak startup production bila secret JWT atau audit tidak memenuhi ketentuan.

## Keamanan dan Integritas Data

- Password disimpan menggunakan bcrypt; password baru minimal 12 karakter.
- Akses memakai JWT pendek dan refresh token yang disimpan sebagai hash di database.
- Lima kegagalan login untuk kombinasi IP dan username mengunci percobaan selama 15 menit.
- Reset/ganti password mencabut sesi aktif pengguna terkait.
- CORS dibatasi ke origin eksplisit bila dikonfigurasi; security headers dan CSP diterapkan.
- Checkout memakai transaksi database, agregasi item, validasi stok atomik, dan harga tier yang dihitung ulang di server.
- Audit event membentuk hash chain dengan `AUDIT_HMAC_KEY`; perubahan event database dapat dideteksi melalui halaman Audit & Diagnostik.
- Backup menggunakan AES-256-GCM dan Argon2id. File yang berubah, password salah, atau header tidak valid ditolak saat restore.
- Restore memeriksa `PRAGMA integrity_check` dan `foreign_key_check` sebelum database pengganti dipakai.

Enkripsi backup melindungi berkas saat dipindahkan/disimpan. Untuk melindungi database aktif, gunakan akun Windows/macOS/Linux khusus aplikasi, permission direktori yang ketat, dan enkripsi disk seperti BitLocker/FileVault.

## Edisi Trial (`trial-v2`)

Branch `trial-v2` dibuat dari baseline `main` dan sengaja tidak memakai mekanisme trial lama. Instalasi baru mendapat trial 7 hari dan maksimal 20 produk. Selama masih trial, import produk, export CSV, backup/restore, dan laporan shift dikunci oleh middleware backend; menyembunyikan tombol di UI bukan kontrol keamanan.

Upgrade dilakukan oleh super admin melalui `POST /api/license/activate` dengan token lisensi bertanda tangan Ed25519. Aplikasi hanya memegang `LICENSE_PUBLIC_KEY`; private key untuk menerbitkan token tidak boleh masuk repository ataupun perangkat pelanggan. Payload lisensi terikat ke `trial_installation_id`, sehingga token dari satu instalasi tidak dapat dipakai pada instalasi lain.

Format token: `poslic-v1.<payload-base64url>.<signature-base64url>`. Payload memuat `license_id`, `product: "kasir-umkm"`, `installation_id`, `issued_at`, dan opsional `expires_at` (RFC3339). Status dapat dibaca melalui `GET /api/license/status` setelah login.

Lisensi offline dapat mencegah key palsu dan pemakaian lintas instalasi, tetapi bukan DRM absolut: orang yang dapat mengganti binary, memanipulasi jam sistem, atau mengedit database dengan akses OS administrator harus tetap dicegah menggunakan permission OS, enkripsi disk, dan prosedur operasional.

## Operasional Harian

1. Login dengan akun kasir.
2. Buka shift dan masukkan kas awal.
3. Scan/cari produk, pilih metode pembayaran, lalu selesaikan checkout.
4. Admin mengelola stok, produk, pelanggan, supplier, promo, dan impor CSV.
5. Di akhir kerja, kasir menutup shift dan memasukkan kas fisik. Sistem menghitung kas harapan dan selisih.
6. Super admin meninjau Audit & Diagnostik serta membuat backup terenkripsi secara berkala.

## Import Produk Batch

Endpoint impor menerima CSV dengan header minimal `barcode_sku,name`. Kolom yang didukung:

```csv
barcode_sku,name,category,buy_price,sell_price,stock,stock_min
8991234567890,Aqua Botol 600ml,Minuman,2500,3500,100,10
```

Impor diproses asynchronous dalam chunk 100 baris agar aman untuk SQLite. Pilihan mode stok:

- `replace_stock`: stok impor mengganti stok saat ini.
- `add_stock`: stok impor ditambahkan ke stok saat ini.
- `product_only`: data produk/harga diperbarui tanpa mengubah stok.

Status job dan detail error tersedia setelah impor selesai.

## Backup dan Restore

1. Super admin membuka **Pengaturan** lalu memilih backup.
2. Masukkan password owner minimal 12 karakter dan simpan file `.posbak` di lokasi aman.
3. Saat restore, pilih `.posbak` dan masukkan password yang sama.
4. Aplikasi menolak file yang tidak terenkripsi, dimodifikasi, memiliki password salah, atau gagal validasi SQLite.

Jika `AUTO_BACKUP_PASSWORD` diset, aplikasi membuat backup otomatis di direktori `BACKUP_DIRECTORY` setiap hari pukul 02:00 dan menghapus backup otomatis yang melewati masa retensi. Password backup tidak disimpan di SQLite.

## Endpoint Penting

| Method | Endpoint | Akses | Keterangan |
| --- | --- | --- | --- |
| `POST` | `/api/login` | Public | Login dan pembuatan sesi |
| `POST` | `/api/refresh-token` | Public | Rotasi access/refresh token |
| `GET` | `/api/health` | Public | Health check database |
| `POST` | `/api/checkout` | Semua role | Checkout POS |
| `POST` | `/api/import/products` | Admin+ | Membuat job impor produk batch |
| `GET` | `/api/import/products/status` | Admin+ | Status job impor |
| `POST` | `/api/shifts/open` | Semua role | Membuka shift kasir |
| `POST` | `/api/shifts/close` | Semua role | Menutup shift dan rekonsiliasi kas |
| `GET` | `/api/reports/shift` | Admin+ | Laporan per kasir/shift |
| `GET` | `/api/export/*` | Super admin | Export CSV sensitif |
| `POST` | `/api/backup` | Super admin | Download backup `.posbak` terenkripsi |
| `POST` | `/api/restore` | Super admin | Restore backup terenkripsi |
| `GET` | `/api/audit-events` | Super admin | Audit event terakhir |
| `GET` | `/api/diagnostics` | Super admin | Integritas DB, audit chain, ukuran, backup |

## Struktur Proyek

```text
.
├── main.go                     # Bootstrap server, route, frontend embed
├── internal/
│   ├── database/               # SQLite schema, migrations, audit chain
│   ├── handlers/               # API handlers
│   ├── middleware/             # JWT, RBAC, CORS, headers, login limiter, audit
│   ├── models/                 # Request/response dan domain model
│   └── services/               # Import chunk, backup crypto/otomatis, shift
├── frontend/                   # React/Vite UI
└── migrations/                 # SQL migrasi historis
```

## Quality Checks

```bash
CGO_ENABLED=1 go test ./...
CGO_ENABLED=1 go vet ./...
go build .
cd frontend && npm run build
cd frontend && npm audit --omit=dev --audit-level=high
```

Test saat ini mencakup crypto backup, parsing dan chunk import, audit-chain tamper detection, login rate limiting, retensi backup otomatis, dan perhitungan selisih shift.

## Troubleshooting

- **Port 8080 sudah dipakai**: hentikan proses lama atau gunakan port lain sesuai konfigurasi aplikasi.
- **CGO belum aktif**: pasang compiler C dan jalankan build dengan `CGO_ENABLED=1`.
- **Database terkunci**: pastikan hanya satu instance aplikasi menggunakan file database yang sama dan periksa permission direktori.
- **Ponsel tidak dapat mengakses**: pastikan ponsel dan PC berada di Wi-Fi/LAN yang sama serta firewall mengizinkan port aplikasi dari LAN tepercaya.
- **Backup tidak dapat dipulihkan**: pastikan file `.posbak` utuh dan password owner sama persis.

---

License: Proprietary. Untuk penggunaan internal/UMKM yang memiliki lisensi sah.
