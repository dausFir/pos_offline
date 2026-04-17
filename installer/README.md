# Kasir UMKM - Setup Installer

Dokumentasi untuk membuat installer Windows dari aplikasi Kasir UMKM.

## 🎯 Overview

Setelah setup ini, Anda bisa distribusikan aplikasi dalam 2 cara:
1. **Standalone** - `kasir-umkm.exe` (langsung jalan, seperti sekarang)
2. **Installer** - `kasir-umkm-installer-v3.4.exe` (install properti ke Windows)

## 📋 Persiapan (One-time setup)

### 1. Install NSIS (Nullsoft Scriptable Install System)
```bash
# Download dari: https://nsis.sourceforge.io/Download
# atau install via chocolatey:
choco install nsis

# atau install via winget:
winget install NSIS.NSIS
```

### 2. Verifikasi NSIS terinstall
Buka command prompt baru dan test:
```bash
makensis /VERSION
# Harus menampilkan versi NSIS (contoh: v3.08)
```

## 🚀 Cara Build Installer

### Opsi 1: Menggunakan Batch Script (Recommended)
```bash
# Jalankan di command prompt:
build-installer.bat
```

### Opsi 2: Menggunakan PowerShell
```powershell
# Jalankan di PowerShell:
.\build-installer.ps1
```

### Opsi 3: Manual Step-by-step
```bash
# 1. Build aplikasi biasa
build.bat

# 2. Copy exe ke folder installer
copy kasir-umkm.exe installer\

# 3. Buat installer
cd installer
makensis kasir-umkm-installer.nsi

# 4. Move installer ke root
move ..\build\kasir-umkm-installer-v3.4.exe ..\kasir-umkm-installer-v3.4.exe
```

## 📦 Output Files

Setelah build berhasil, Anda akan mendapat:

1. **kasir-umkm.exe** (15-20 MB)
   - Aplikasi standalone seperti biasa
   - Langsung bisa di-double click
   - Tidak perlu install

2. **kasir-umkm-installer-v3.4.exe** (15-20 MB)
   - Installer Windows profesional
   - Install ke `C:\Program Files\Kasir UMKM\`
   - Buat shortcut desktop & start menu
   - Masuk ke Add/Remove Programs
   - Include uninstaller

## ✨ Fitur Installer

### Yang dilakukan installer:
- ✅ Install ke `Program Files`
- ✅ Shortcut desktop
- ✅ Shortcut Start Menu
- ✅ Registry entries untuk Add/Remove Programs
- ✅ License agreement
- ✅ Uninstaller otomatis
- ✅ Version info & publisher details

### User experience:
1. Download `kasir-umkm-installer-v3.4.exe`
2. Run as Administrator (otomatis request)
3. Next → Accept License → Install
4. Shortcut muncul di desktop
5. Klik shortcut → browser buka → login admin/admin123

## 🔧 Customization

### Update versi di installer:
Edit `installer/kasir-umkm-installer.nsi`:
```nsis
!define APP_VERSION "3.5"  ; <- Update di sini
```

### Update license:
Edit `installer/license.txt`

### Add icon:
1. Tambah file icon: `installer/kasir-umkm.ico`
2. Update di script NSIS:
```nsis
!define MUI_ICON "kasir-umkm.ico"
```

## 🚀 Distribusi

### Untuk client yang tech-savvy:
- Kirim `kasir-umkm.exe` (standalone)

### Untuk client yang prefer installer profesional:
- Kirim `kasir-umkm-installer-v3.4.exe`

### Upload ke website/cloud:
```bash
# File sizes (approximate):
kasir-umkm.exe                    # ~15-20 MB
kasir-umkm-installer-v3.4.exe     # ~15-20 MB
```

## 🐛 Troubleshooting

### Error: "makensis not found"
```bash
# Pastikan NSIS terinstall dan di PATH
# Restart command prompt setelah install NSIS
where makensis  # harus return path ke makensis.exe
```

### Error: "Access denied" saat build
```bash
# Pastikan kasir-umkm.exe tidak sedang running
# Close semua instance aplikasi dulu
```

### Installer tidak jalan di komputer lain
- Pastikan target komputer punya Visual C++ Redistributable
- Include `vcredist_x64.exe` dalam distribusi jika perlu

## 💡 Tips

1. **Always test installer** di komputer bersih dulu
2. **Update version number** di NSIS script untuk setiap release
3. **Sign installer** dengan code signing certificate untuk produksi
4. **Include database** kosong di installer jika perlu
5. **Add auto-update mechanism** di aplikasi untuk next version

## 🎉 Next Steps

Setelah ini working, bisa consider:
- **Code signing** untuk remove "Unknown publisher" warning
- **Auto-updater** dalam aplikasi
- **MSI installer** dengan WiX toolset
- **Portable version** dengan data di folder aplikasi