# RapiPos

> **Kasir, stok, dan usaha lebih rapi.**
>
> POS offline-first untuk toko, warung, dan usaha jasa skala UMKM.

RapiPos berjalan sebagai satu aplikasi lokal di PC toko. Data disimpan di SQLite pada PC tersebut, sehingga transaksi tetap dapat dilakukan ketika internet mati. Perangkat lain—termasuk ponsel—cukup membuka alamat LAN yang ditampilkan aplikasi.

> RapiPos dirancang untuk **jaringan lokal tepercaya**. Jangan membuka port aplikasi ke internet atau melakukan port-forward pada router.

## Mulai dari sini

1. Jalankan aplikasi RapiPos di PC toko.
2. Login sebagai owner untuk menyelesaikan pengaturan toko, pengguna, dan alamat server tracking bila digunakan.
3. Gunakan menu **Kasir** untuk transaksi barang atau jasa; alamat LAN pada dashboard dapat dibuka dari perangkat lain di jaringan yang sama.

Petunjuk instalasi, konfigurasi, backup, dan pengembangan tersedia di bagian-bagian berikut.

## Yang Bisa Dilakukan

| Area | Kemampuan utama |
| --- | --- |
| **Penjualan** | Barcode, diskon, PPN, tunai, QRIS, e-wallet, split payment, piutang pelanggan, dan nota. |
| **Produk & stok** | Produk fisik dan jasa, kategori, supplier, stok minimum, mutasi, harga grosir, stock opname, dan impor CSV bertahap. |
| **Usaha jasa** | Order servis, DP, teknisi, progres pengerjaan, sparepart, biaya kerja/vendor, pelunasan, dan margin per order. |
| **Kontrol owner** | Dashboard, laba-rugi, pengeluaran, settlement QRIS/e-wallet, closing periode, shift, dan laporan. |
| **Keamanan** | Role-based access, audit trail berantai, backup terenkripsi, restore tervalidasi, dan lisensi terikat perangkat. |
| **Pengalaman pakai** | Tampilan RapiPos yang responsif untuk desktop, tablet, dan ponsel; light mode serta dark mode. |

## Peran Pengguna

| Aktivitas | Kasir | Admin | Super admin |
| --- | :---: | :---: | :---: |
| POS, checkout, buka/tutup shift | ✓ | ✓ | ✓ |
| Produk, stok, supplier, pelanggan, diskon | — | ✓ | ✓ |
| Dashboard, laporan, import CSV, kontrol akuntansi | — | ✓ | ✓ |
| User, export CSV, backup/restore, audit, lisensi | — | — | ✓ |

## Cara Kerja Singkat

1. Owner/super admin menyiapkan produk atau jasa, pengguna, dan pengaturan toko.
2. Kasir membuka shift, memasukkan kas awal, lalu memproses transaksi.
3. Untuk servis, petugas membuat order, mencatat DP dan progres, menambahkan sparepart/biaya bila diperlukan, lalu memfinalkan pembayaran.
4. Di akhir shift, kasir memasukkan kas fisik dan RapiPos menghitung selisihnya.
5. Owner meninjau laporan, audit, serta membuat backup terenkripsi secara berkala.

## Akses dari Ponsel di Jaringan Toko

Saat aplikasi hidup, RapiPos menampilkan alamat PC dan alamat LAN. Owner/admin juga dapat melihatnya di **Dashboard → Akses dari HP / tablet**.

1. Hubungkan ponsel dan PC kasir ke Wi-Fi/LAN yang sama.
2. Buka alamat seperti `http://192.168.1.20:8080` di browser ponsel.
3. Login dengan akun yang sesuai.

Secara default aplikasi memakai port `8080`. Jika port tersebut sudah dipakai, RapiPos mencoba sepuluh port berikutnya lalu memilih port kosong secara otomatis. Alamat yang tampil di Dashboard adalah alamat yang harus dipakai—bukan selalu `8080`.

## Mulai untuk Pengembang

### Prasyarat

- Go 1.21+ dengan CGO aktif
- Node.js 18+
- Compiler C untuk SQLite: TDM-GCC/MinGW (Windows), Xcode Command Line Tools (macOS), atau `build-essential` (Linux)

### Jalankan lokal

```bash
git clone https://github.com/dausFir/pos_offline.git
cd pos_offline

cp .env.example .env
# Isi JWT_SECRET, AUDIT_HMAC_KEY, dan INITIAL_ADMIN_PASSWORD di .env

cd frontend
npm install
npm run build
cd ..

CGO_ENABLED=1 go run .
```

Buka `http://localhost:8080` atau alamat LAN yang tercetak di terminal. Saat database baru dibuat, akun awal adalah `admin`; password-nya berasal dari `INITIAL_ADMIN_PASSWORD`.

> Fitur bisnis memakai lisensi perangkat. Build pengembangan tetap dapat dibuka, tetapi checkout dan fungsi bisnis akan terkunci hingga binary memiliki public key lisensi dan token perangkat yang valid.

### Build rilis Windows

Public key Ed25519 harus di-embed oleh penerbit sebelum binary dibagikan. Private key penerbit **tidak boleh** masuk ke repository, binary, atau PC pelanggan.

```powershell
$env:LICENSE_PUBLIC_KEY = "BASE64_ED25519_PUBLIC_KEY"
.\build.bat
```

Hasilnya adalah `RapiPos.exe`. Jalankan binary dari folder yang boleh ditulis aplikasi karena `database.sqlite`, file backup, dan konfigurasi runtime akan disimpan di sana.

Untuk build melalui Makefile:

```bash
make build LICENSE_PUBLIC_KEY="BASE64_ED25519_PUBLIC_KEY"
```

## Konfigurasi Runtime

Salin `.env.example` menjadi `.env`; jangan commit file `.env` yang berisi secret asli.

| Variabel | Wajib | Fungsi |
| --- | :---: | --- |
| `GO_ENV` | Produksi | Gunakan `production` pada instalasi rilis. |
| `JWT_SECRET` | Ya | Secret JWT, minimal 32 karakter di produksi. |
| `AUDIT_HMAC_KEY` | Produksi | Kunci terpisah untuk verifikasi audit trail, minimal 32 karakter. |
| `INITIAL_ADMIN_PASSWORD` | Database baru | Password awal akun `admin`, minimal 12 karakter. |
| `SERVER_HOST` | Tidak | Default `0.0.0.0`; gunakan `127.0.0.1` jika hanya boleh dibuka dari PC server. |
| `SERVER_PORT` | Tidak | Port awal, default `8080`; fallback otomatis jika bentrok. |
| `AUTO_BACKUP_PASSWORD` | Tidak | Mengaktifkan backup otomatis terenkripsi setiap hari pukul 02:00. |
| `BACKUP_DIRECTORY` / `BACKUP_RETENTION_DAYS` | Tidak | Lokasi dan retensi backup otomatis. |
| `TRACKING_SYNC_URL` | Tidak | Endpoint tracker publik, harus berakhir dengan `/api/sync`. |
| `TRACKING_SYNC_SECRET` | Jika tracking aktif | Secret HMAC yang sama dengan server tracking; tidak pernah disimpan di UI atau SQLite. |
| `CORS_ALLOWED_ORIGIN` | Tidak | Hanya untuk frontend development server terpisah. |

## Lisensi Perangkat

RapiPos versi penuh menggunakan lisensi offline per perangkat. Instalasi membuat `installation_id` dan hash identitas perangkat; identitas perangkat mentah tidak disimpan maupun dikirim.

1. Login sebagai super admin.
2. Pada pemberitahuan lisensi, pilih **Salin Kode Aktivasi**.
3. Kirim kode tersebut ke penerbit lisensi.
4. Masukkan token `poslic-v1.…` yang diterbitkan melalui **Aktivasi Lisensi**.

Token diverifikasi menggunakan Ed25519 dan hanya berlaku jika signature, produk, `installation_id`, serta hash perangkat cocok. Jika PC atau OS diganti, penerbit perlu menerbitkan token baru. Backup data dapat dipulihkan ke perangkat baru, namun lisensinya tetap harus diaktifkan ulang.

## Jasa & Tracking Pelanggan

Item dapat berupa **barang fisik** atau **jasa**. Jasa tidak memiliki stok dan tidak membuat mutasi stok. Sparepart tetap memakai produk fisik biasa agar stok, harga, dan biaya tercatat secara konsisten. Order bergerak dari penerimaan hingga **Siap Diambil**; invoice final hanya dapat dibuat pada status tersebut agar order batal atau pekerjaan yang belum selesai tidak tertagih.

Setiap order servis memiliki token tracking acak. Sinkronisasi menuju halaman tracking publik bersifat opsional:

- Atur URL dari **Pengaturan → Tracking Servis Publik**, atau gunakan `TRACKING_SYNC_URL` dari environment.
- RapiPos menyimpan perubahan di outbox lokal lebih dulu, lalu menyinkronkan ketika internet tersedia.
- Gangguan tracking tidak menghentikan kasir maupun teknisi.
- Jangan pernah mengekspos file SQLite atau API RapiPos ke internet. Hanya aplikasi tracker publik yang boleh dideploy, misalnya ke Vercel.

Referensi aplikasi tracker: [pos-service-tracking](https://github.com/dausFir/pos-service-tracking).

## Keamanan & Backup

- Password disimpan dengan bcrypt; perubahan password mencabut sesi aktif pengguna terkait.
- Lima kegagalan login pada kombinasi IP dan username mengunci percobaan selama 15 menit.
- Checkout menggunakan transaksi SQLite, validasi stok atomik, dan perhitungan harga ulang di server.
- Audit event membentuk hash chain dengan `AUDIT_HMAC_KEY`; perubahan data dapat diperiksa lewat **Audit & Diagnostik**.
- File backup `.posbak` dienkripsi menggunakan AES-256-GCM dengan password yang diturunkan oleh Argon2id.
- Restore menolak file yang password-nya salah, telah berubah, atau gagal `integrity_check`/`foreign_key_check` SQLite.

Enkripsi backup melindungi berkas saat disalin atau disimpan. Database aktif tetap harus dilindungi oleh akun OS khusus aplikasi, permission folder ketat, serta enkripsi disk seperti BitLocker atau FileVault.

### Backup manual

1. Login sebagai super admin dan buka **Pengaturan**.
2. Buat backup menggunakan password owner minimal 12 karakter.
3. Simpan file `.posbak` di media aman yang terpisah dari PC kasir.
4. Uji restore berkala pada salinan lingkungan, bukan saat toko sedang bertransaksi.

## Import Produk Batch

Gunakan menu **Import Produk** untuk mengunggah CSV. Header minimal:

```csv
barcode_sku,name,category,buy_price,sell_price,stock,stock_min
8991234567890,Aqua Botol 600ml,Minuman,2500,3500,100,10
```

Impor diproses asinkron dalam chunk 100 baris. Pilih salah satu mode stok berikut:

- `replace_stock` — mengganti stok saat ini.
- `add_stock` — menambahkan stok ke stok saat ini.
- `product_only` — memperbarui data produk/harga tanpa mengubah stok.

Status proses dan baris yang gagal tersedia setelah job selesai.

## Struktur Proyek

```text
.
├── main.go                  # Server Go, router, LAN listener, frontend embed
├── internal/
│   ├── database/            # SQLite, migrasi, audit chain
│   ├── handlers/            # HTTP handler
│   ├── middleware/          # JWT, RBAC, CORS, rate limit, lisensi, audit
│   ├── models/              # Model domain dan API
│   └── services/            # Backup, import, shift, akuntansi, tracking
├── frontend/                # React + Vite UI
├── .env.example             # Referensi konfigurasi runtime
├── build.bat                # Build rilis Windows
└── Makefile                 # Build lintas platform
```

## Quality Checks

```bash
CGO_ENABLED=1 go test ./...
CGO_ENABLED=1 go vet ./...
go build .

cd frontend
npm test
npm run build
```

Test mencakup enkripsi backup, import dan chunk CSV, audit-chain tamper detection, login rate limiting, lisensi perangkat, shift, akuntansi, pembayaran, dan alur service order.

## Troubleshooting

| Masalah | Tindakan |
| --- | --- |
| Ponsel tidak bisa membuka POS | Pastikan satu Wi-Fi/LAN, gunakan alamat yang tampil di Dashboard, lalu izinkan port aplikasi melalui firewall jaringan privat. |
| Port default dipakai aplikasi lain | Jalankan saja RapiPos; ia akan memilih port alternatif dan menampilkan alamat terbaru. |
| Database terkunci | Pastikan hanya satu instance memakai `database.sqlite` dan cek permission folder aplikasi. |
| Lisensi belum aktif | Salin kode aktivasi sebagai super admin dan minta token yang sesuai untuk perangkat tersebut. |
| Backup gagal dipulihkan | Pastikan file `.posbak` utuh dan password backup sama persis. |

## Lisensi Repository

Proprietary. Untuk penggunaan internal atau UMKM dengan lisensi RapiPos yang sah.
