LICENSE_PUBLIC_KEY ?=

.PHONY: all build-frontend build-go dev clean

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
