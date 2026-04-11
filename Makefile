.PHONY: all build-frontend build-go dev clean

all: build

build: build-frontend build-go
	@echo ""
	@echo "✅ Build selesai: kasir-umkm.exe"

build-frontend:
	@echo "📦 Building React frontend..."
	cd frontend && npm install && npm run build

build-go:
	@echo "🔨 Compiling Go binary..."
	go mod tidy
	CGO_ENABLED=1 GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o kasir-umkm.exe .

build-linux:
	@echo "🔨 Compiling for Linux..."
	go mod tidy
	CGO_ENABLED=1 go build -ldflags="-s -w" -o kasir-umkm .

dev-backend:
	@echo "🚀 Starting Go dev server..."
	go run main.go

dev-frontend:
	@echo "🚀 Starting React dev server..."
	cd frontend && npm run dev

clean:
	rm -f kasir-umkm kasir-umkm.exe database.sqlite
	rm -rf frontend/dist
	@echo "🧹 Cleaned build artifacts"
