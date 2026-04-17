@echo off
echo ========================================
echo   BUILD KASIR UMKM INSTALLER v3.4
echo   Membangun aplikasi + installer
echo ========================================
echo.

rem Cek NSIS sudah terinstall atau belum
where makensis >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] NSIS tidak ditemukan!
    echo.
    echo Silakan install NSIS terlebih dahulu:
    echo   1. Download dari: https://nsis.sourceforge.io/Download
    echo   2. Install NSIS dengan default settings
    echo   3. Restart command prompt
    echo   4. Jalankan script ini lagi
    echo.
    pause
    exit /b 1
)

rem Jalankan build aplikasi normal dulu
echo [STEP 1] Membangun aplikasi...
call build.bat
if %errorlevel% neq 0 (
    echo [ERROR] Build aplikasi gagal!
    pause
    exit /b 1
)

echo.
echo [STEP 2] Membuat installer...

rem Buat folder build jika belum ada
if not exist "build" mkdir build

rem Copy executable ke root untuk installer
copy kasir-umkm.exe installer\
if %errorlevel% neq 0 (
    echo [ERROR] Gagal copy kasir-umkm.exe
    pause
    exit /b 1
)

rem Kompile installer dengan NSIS
cd installer
makensis kasir-umkm-installer.nsi
if %errorlevel% neq 0 (
    echo [ERROR] Gagal membuat installer
    pause
    exit /b 1
)

rem Pindahkan installer ke folder build
move ..\build\kasir-umkm-installer-v3.4.exe ..\kasir-umkm-installer-v3.4.exe

rem Cleanup
del kasir-umkm.exe

cd ..

echo.
echo ========================================
echo   BUILD INSTALLER BERHASIL!
echo ========================================
echo.
echo File yang dihasilkan:
echo   - kasir-umkm.exe (aplikasi standalone)
echo   - kasir-umkm-installer-v3.4.exe (installer)
echo.
echo CARA DISTRIBUSI:
echo   1. Standalone: Kirim kasir-umkm.exe (langsung jalan)
echo   2. Installer: Kirim kasir-umkm-installer-v3.4.exe
echo.
echo INSTALLER FEATURES:
echo   - Install ke Program Files
echo   - Shortcut Desktop + Start Menu
echo   - Add/Remove Programs entry
echo   - Uninstaller otomatis
echo   - License agreement
echo.
pause