@echo off
echo ========================================
echo   BUILD KASIR UMKM v2.0 - Windows
echo   Fase 5: Stok, Diskon, QRIS, Export
echo ========================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js tidak ditemukan!
    echo Silakan install dari https://nodejs.org
    pause & exit /b 1
)

where go >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Go tidak ditemukan!
    echo Silakan install dari https://golang.org/dl
    pause & exit /b 1
)

if "%LICENSE_PUBLIC_KEY%"=="" (
    echo [ERROR] LICENSE_PUBLIC_KEY belum diisi.
    echo Set public key Ed25519 base64 sebelum build rilis.
    pause & exit /b 1
)

echo Memeriksa GCC (dibutuhkan untuk SQLite)...
where gcc >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] GCC tidak ditemukan.
    echo Pasang TDM-GCC dari: https://jmeubank.github.io/tdm-gcc/
    echo Setelah install, restart CMD dan jalankan build.bat lagi.
    pause & exit /b 1
)

echo [1/4] Install dependensi frontend...
cd frontend
call npm install
if %errorlevel% neq 0 (echo [ERROR] npm install gagal & pause & exit /b 1)

echo.
echo [2/4] Build React frontend...
call npm run build
if %errorlevel% neq 0 (echo [ERROR] Build frontend gagal & pause & exit /b 1)
cd ..

echo.
echo [3/4] Download dependensi Go...
go mod tidy
if %errorlevel% neq 0 (echo [ERROR] go mod tidy gagal & pause & exit /b 1)

echo.
echo [4/4] Compile ke kasir-umkm.exe ...
set CGO_ENABLED=1
set GOOS=windows
set GOARCH=amd64
go build -ldflags="-s -w -X kasir-umkm/internal/services.LicensePublicKeyBase64=%LICENSE_PUBLIC_KEY%" -o kasir-umkm.exe .
if %errorlevel% neq 0 (
    echo [ERROR] Build Go gagal
    pause & exit /b 1
)

echo.
echo ========================================
echo   BUILD BERHASIL!
echo ========================================
echo.
echo File output: kasir-umkm.exe
echo.
echo CARA PAKAI:
echo   1. Klik 2x kasir-umkm.exe
echo   2. Browser terbuka otomatis
echo   3. Login: admin / password dari INITIAL_ADMIN_PASSWORD
echo   4. Buka dari HP: lihat IP di terminal
echo.
echo FITUR v3.1 (TERBARU):
echo   - Mutasi Stok (masuk/keluar/koreksi)
echo   - Promo dan Kode Diskon
echo   - QRIS Image upload di Pengaturan
echo   - Export CSV (transaksi, produk, stok)
echo   - Backup dan Restore database
echo ========================================
pause
