param(
  [Parameter(Mandatory = $true)][string]$LicensePublicKey
)

$ErrorActionPreference = 'Stop'
foreach ($tool in @('go', 'node', 'npm', 'gcc', 'garble')) {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
    throw "$tool tidak ditemukan. Untuk obfuscation install: go install mvdan.cc/garble@latest"
  }
}

Push-Location frontend
npm ci
npm run build
Pop-Location

$env:CGO_ENABLED = '1'
$env:GOOS = 'windows'
$env:GOARCH = 'amd64'
garble -literals -tiny build -trimpath -buildvcs=false `
  -ldflags "-s -w -buildid= -X kasir-umkm/internal/services.LicensePublicKeyBase64=$LicensePublicKey" `
  -o RapiPos.exe .

Get-FileHash RapiPos.exe -Algorithm SHA256 | ForEach-Object { "$($_.Hash.ToLower())  RapiPos.exe" } | Set-Content RapiPos.exe.sha256 -NoNewline
Write-Host "Rilis siap: RapiPos.exe dan RapiPos.exe.sha256" -ForegroundColor Green
