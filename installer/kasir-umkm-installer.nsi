; NSIS Script untuk Kasir UMKM Installer
; Versi 3.4

!define APP_NAME "Kasir UMKM"
!define APP_VERSION "3.4"
!define APP_PUBLISHER "Kasir UMKM Team"
!define APP_URL "https://github.com/yourusername/kasir-umkm"
!define APP_FILENAME "kasir-umkm"

; Konfigurasi umum
Name "${APP_NAME} ${APP_VERSION}"
OutFile "../build/kasir-umkm-installer-v${APP_VERSION}.exe"
InstallDir "$PROGRAMFILES64\${APP_NAME}"
InstallDirRegKey HKLM "Software\${APP_NAME}" "InstallPath"

; Request administrator privileges
RequestExecutionLevel admin

; Modern UI
!include "MUI2.nsh"

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "license.txt"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; Languages
!insertmacro MUI_LANGUAGE "Indonesian"
!insertmacro MUI_LANGUAGE "English"

; Version Information
VIProductVersion "3.4.0.0"
VIAddVersionKey "ProductName" "${APP_NAME}"
VIAddVersionKey "CompanyName" "${APP_PUBLISHER}"
VIAddVersionKey "FileDescription" "Aplikasi Kasir untuk UMKM"
VIAddVersionKey "FileVersion" "${APP_VERSION}"
VIAddVersionKey "ProductVersion" "${APP_VERSION}"
VIAddVersionKey "LegalCopyright" "© 2026 ${APP_PUBLISHER}"

; Brands
!define MUI_WELCOMEPAGE_TEXT "Setup akan menginstall ${APP_NAME} di komputer Anda.$\r$\n$\r$\nAplikasi kasir lengkap untuk usaha kecil dan menengah dengan fitur POS, manajemen stok, laporan, dan QRIS."

!define MUI_FINISHPAGE_TEXT "${APP_NAME} berhasil diinstall!$\r$\n$\r$\nUntuk memulai:$\r$\n1. Klik ikon ${APP_NAME} di desktop atau Start Menu$\r$\n2. Browser akan terbuka otomatis ke http://localhost:8080$\r$\n3. Login dengan: admin / admin123$\r$\n$\r$\nSelamat menggunakan!"

!define MUI_FINISHPAGE_RUN "$INSTDIR\kasir-umkm.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Jalankan ${APP_NAME} sekarang"

; Installation Section
Section "Kasir UMKM" SecMain
  SectionIn RO
  
  ; Set output path to the installation directory
  SetOutPath $INSTDIR
  
  ; Files to install
  File "kasir-umkm.exe"
  File /nonfatal "..\database.sqlite"
  
  ; Create start menu folder and shortcuts
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortCut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\kasir-umkm.exe"
  CreateShortCut "$SMPROGRAMS\${APP_NAME}\Uninstall ${APP_NAME}.lnk" "$INSTDIR\Uninstall.exe"
  
  ; Create desktop shortcut
  CreateShortCut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\kasir-umkm.exe"
  
  ; Write registry information
  WriteRegStr HKLM "Software\${APP_NAME}" "InstallPath" $INSTDIR
  WriteRegStr HKLM "Software\${APP_NAME}" "Version" "${APP_VERSION}"
  
  ; Write uninstall information
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "DisplayIcon" "$INSTDIR\kasir-umkm.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "Publisher" "${APP_PUBLISHER}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "URLInfoAbout" "${APP_URL}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "DisplayVersion" "${APP_VERSION}"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "NoRepair" 1
  
  ; Create uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"
SectionEnd

; Uninstaller Section
Section "Uninstall"
  ; Remove files
  Delete "$INSTDIR\kasir-umkm.exe"
  Delete "$INSTDIR\database.sqlite"
  Delete "$INSTDIR\Uninstall.exe"
  
  ; Remove shortcuts
  Delete "$DESKTOP\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\Uninstall ${APP_NAME}.lnk"
  RMDir "$SMPROGRAMS\${APP_NAME}"
  
  ; Remove registry entries
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}"
  DeleteRegKey HKLM "Software\${APP_NAME}"
  
  ; Remove installation directory
  RMDir "$INSTDIR"
SectionEnd

; Section Descriptions
!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SecMain} "File aplikasi utama Kasir UMKM"
!insertmacro MUI_FUNCTION_DESCRIPTION_END