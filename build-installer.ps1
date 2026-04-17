# Build Script untuk Kasir UMKM Installer
# PowerShell version untuk yang lebih prefer PS

Write-Host "========================================" -ForegroundColor Green
Write-Host "   BUILD KASIR UMKM INSTALLER v3.4" -ForegroundColor Green  
Write-Host "   Membangun aplikasi + installer" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Function untuk check command existence
function Test-Command($cmdname) {
    return [bool](Get-Command -Name $cmdname -ErrorAction SilentlyContinue)
}

# Cek NSIS
if (-not (Test-Command "makensis")) {
    Write-Host "[ERROR] NSIS tidak ditemukan!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Silakan install NSIS terlebih dahulu:" -ForegroundColor Yellow
    Write-Host "  1. Download dari: https://nsis.sourceforge.io/Download" -ForegroundColor Yellow
    Write-Host "  2. Install NSIS dengan default settings" -ForegroundColor Yellow
    Write-Host "  3. Restart PowerShell" -ForegroundColor Yellow
    Write-Host "  4. Jalankan script ini lagi" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Build aplikasi
Write-Host "[STEP 1] Membangun aplikasi..." -ForegroundColor Cyan
& .\build.bat
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Build aplikasi gagal!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "[STEP 2] Membuat installer..." -ForegroundColor Cyan

# Buat folder build
if (-not (Test-Path "build")) {
    New-Item -ItemType Directory -Name "build" | Out-Null
}

# Copy executable untuk installer
Copy-Item "kasir-umkm.exe" -Destination "installer\" -Force
if (-not $?) {
    Write-Host "[ERROR] Gagal copy kasir-umkm.exe" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Compile installer
Set-Location "installer"
& makensis kasir-umkm-installer.nsi
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Gagal membuat installer" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Move installer ke root
Move-Item "..\build\kasir-umkm-installer-v3.4.exe" -Destination "..\kasir-umkm-installer-v3.4.exe" -Force

# Cleanup
Remove-Item "kasir-umkm.exe" -Force

Set-Location ".."

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   BUILD INSTALLER BERHASIL!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "File yang dihasilkan:" -ForegroundColor White
Write-Host "  - kasir-umkm.exe (aplikasi standalone)" -ForegroundColor Yellow
Write-Host "  - kasir-umkm-installer-v3.4.exe (installer)" -ForegroundColor Yellow
Write-Host ""

Write-Host "CARA DISTRIBUSI:" -ForegroundColor White
Write-Host "  1. Standalone: Kirim kasir-umkm.exe (langsung jalan)" -ForegroundColor Gray
Write-Host "  2. Installer: Kirim kasir-umkm-installer-v3.4.exe" -ForegroundColor Gray
Write-Host ""

Write-Host "INSTALLER FEATURES:" -ForegroundColor White
Write-Host "  - Install ke Program Files" -ForegroundColor Gray
Write-Host "  - Shortcut Desktop + Start Menu" -ForegroundColor Gray
Write-Host "  - Add/Remove Programs entry" -ForegroundColor Gray
Write-Host "  - Uninstaller otomatis" -ForegroundColor Gray
Write-Host "  - License agreement" -ForegroundColor Gray
Write-Host ""

Read-Host "Press Enter to exit"