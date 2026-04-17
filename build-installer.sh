#!/bin/bash

echo "========================================"
echo "   BUILD KASIR UMKM INSTALLER v3.4"
echo "   Cross-platform build script"
echo "========================================"
echo ""

# Check if running on Windows (Git Bash, WSL, etc.)
if command -v makensis &> /dev/null; then
    echo "[INFO] NSIS detected, building Windows installer..."
    
    # Run the Windows build script
    if [ -f "build-installer.bat" ]; then
        ./build-installer.bat
    else
        echo "[ERROR] build-installer.bat not found!"
        exit 1
    fi
    
elif command -v wine &> /dev/null && [ -f "/usr/share/nsis" ]; then
    echo "[INFO] Wine + NSIS detected, building with Wine..."
    
    # Build app first
    echo "[STEP 1] Building application..."
    make build
    
    # Create installer with Wine
    echo "[STEP 2] Creating installer with Wine..."
    mkdir -p build
    cp kasir-umkm.exe installer/
    cd installer
    wine makensis kasir-umkm-installer.nsi
    mv ../build/kasir-umkm-installer-v3.4.exe ../kasir-umkm-installer-v3.4.exe
    rm kasir-umkm.exe
    cd ..
    
    echo ""
    echo "✅ Installer berhasil dibuat dengan Wine!"
    
else
    echo "[INFO] Windows installer tidak bisa dibuat di platform ini."
    echo ""
    echo "Untuk membuat installer Windows:"
    echo "  1. Jalankan di Windows dengan NSIS terinstall"
    echo "  2. Atau gunakan Wine + NSIS di Linux/macOS:"
    echo "     sudo apt install wine nsis  # Ubuntu/Debian"
    echo "     brew install wine nsis      # macOS"
    echo ""
    echo "Sementara ini, build aplikasi biasa saja..."
    make build
fi

echo ""
echo "Build selesai!"