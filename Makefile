LICENSE_PUBLIC_KEY ?=

.PHONY: all build-frontend build-go release dev clean

all: build

build: build-frontend build-go
	@echo ""
	@echo "✅ Build selesai: RapiPos.exe"

build-frontend:
	@echo "📦 Building React frontend..."
	cd frontend && npm install && npm run build

build-go:
	@echo "🔨 Compiling Go binary..."
	@test -n "$(LICENSE_PUBLIC_KEY)" || (echo "LICENSE_PUBLIC_KEY wajib diisi untuk build rilis"; exit 1)
	go mod tidy
	CGO_ENABLED=1 GOOS=windows GOARCH=amd64 go build -ldflags="-s -w -X kasir-umkm/internal/services.LicensePublicKeyBase64=$(LICENSE_PUBLIC_KEY)" -o RapiPos.exe .

# Release uses garble to raise the cost of reverse engineering. It does not
# replace code signing or secure handling of secrets.
release: build-frontend
	@test -n "$(LICENSE_PUBLIC_KEY)" || (echo "LICENSE_PUBLIC_KEY wajib diisi untuk build rilis"; exit 1)
	@command -v garble >/dev/null || (echo "garble wajib diinstall: go install mvdan.cc/garble@latest"; exit 1)
	CGO_ENABLED=1 GOOS=windows GOARCH=amd64 garble -literals -tiny build -trimpath -buildvcs=false -ldflags="-s -w -buildid= -X kasir-umkm/internal/services.LicensePublicKeyBase64=$(LICENSE_PUBLIC_KEY)" -o RapiPos.exe .
	@sha256sum RapiPos.exe > RapiPos.exe.sha256

build-linux:
	@echo "🔨 Compiling for Linux..."
	go mod tidy
	CGO_ENABLED=1 go build -ldflags="-s -w" -o RapiPos .

dev-backend:
	@echo "🚀 Starting Go dev server..."
	go run main.go

dev-frontend:
	@echo "🚀 Starting React dev server..."
	cd frontend && npm run dev

clean:
	rm -f RapiPos RapiPos.exe database.sqlite
	rm -rf frontend/dist
	@echo "🧹 Cleaned build artifacts"
