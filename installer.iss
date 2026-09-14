; Build with Inno Setup 6 after running build.bat.
[Setup]
AppName=RapiPos
AppVersion=3.2
DefaultDirName={autopf}\RapiPos
DefaultGroupName=RapiPos
OutputBaseFilename=RapiPos-Setup
Compression=lzma2
SolidCompression=yes

[Files]
Source: "RapiPos.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\RapiPos"; Filename: "{app}\RapiPos.exe"
Name: "{autodesktop}\RapiPos"; Filename: "{app}\RapiPos.exe"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Buat shortcut desktop"; Flags: unchecked

[Run]
Filename: "{app}\RapiPos.exe"; Description: "Jalankan RapiPos"; Flags: nowait postinstall skipifsilent
