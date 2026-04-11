package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os/exec"
	"runtime"
	"time"

	"kasir-umkm/internal/database"
	"kasir-umkm/internal/handlers"
	"kasir-umkm/internal/middleware"

	"github.com/gorilla/mux"
)

//go:embed frontend/dist
var frontendFiles embed.FS

func main() {
	fmt.Println("╔══════════════════════════════════════════════════╗")
	fmt.Println("║        KASIR & MANAJEMEN GUDANG UMKM v3.1        ║")
	fmt.Println("║     Offline-First · Beli Putus · UMKM Ready      ║")
	fmt.Println("╚══════════════════════════════════════════════════╝")
	fmt.Println()

	fmt.Println("📦 Menginisialisasi database...")
	if err := database.Init("database.sqlite"); err != nil {
		log.Fatalf("❌ Gagal inisialisasi database: %v", err)
	}

	r := mux.NewRouter()
	r.Use(middleware.CORSMiddleware)
	api := r.PathPrefix("/api").Subrouter()

	// ── Public ─────────────────────────────────────────────────────────────────
	api.HandleFunc("/login", handlers.Login).Methods("POST", "OPTIONS")
	api.HandleFunc("/status", handlers.GetServerStatus).Methods("GET", "OPTIONS") // Kritis #5 — no auth needed

	// ── Protected ──────────────────────────────────────────────────────────────
	prot := api.NewRoute().Subrouter()
	prot.Use(middleware.AuthMiddleware)

	prot.HandleFunc("/me", handlers.GetMe).Methods("GET")
	prot.HandleFunc("/change-password", handlers.ChangePassword).Methods("POST") // Kritis #1

	// Categories (Kritis #3)
	prot.Handle("/categories", middleware.RequireRole("super_admin", "admin", "cashier")(http.HandlerFunc(handlers.GetCategories))).Methods("GET")
	prot.Handle("/categories", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.CreateCategory))).Methods("POST")
	prot.Handle("/categories/{id}", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.UpdateCategory))).Methods("PUT")
	prot.Handle("/categories/{id}", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.DeleteCategory))).Methods("DELETE")

	// Products (Kritis #3 category + #4 stock_min)
	prot.Handle("/products", middleware.RequireRole("super_admin", "admin", "cashier")(http.HandlerFunc(handlers.GetProducts))).Methods("GET")
	prot.Handle("/products/barcode/{barcode}", middleware.RequireRole("super_admin", "admin", "cashier")(http.HandlerFunc(handlers.GetProductByBarcode))).Methods("GET")
	prot.Handle("/products/{id}/stock-history", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.GetProductStockHistory))).Methods("GET")
	prot.Handle("/products/{id}/price-history", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.GetPriceHistory))).Methods("GET")
	prot.Handle("/products/{id}", middleware.RequireRole("super_admin", "admin", "cashier")(http.HandlerFunc(handlers.GetProduct))).Methods("GET")
	prot.Handle("/products", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.CreateProduct))).Methods("POST")
	prot.Handle("/products/{id}", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.UpdateProduct))).Methods("PUT")
	prot.Handle("/products/{id}", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.DeleteProduct))).Methods("DELETE")

	// Transactions (Kritis #6 split payment)
	prot.Handle("/checkout", middleware.RequireRole("super_admin", "admin", "cashier")(http.HandlerFunc(handlers.Checkout))).Methods("POST")
	prot.Handle("/transactions", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.GetTransactions))).Methods("GET")
	prot.Handle("/transactions/{id}", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.GetTransaction))).Methods("GET")
	prot.Handle("/transactions/{id}/cancel", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.CancelTransaction))).Methods("POST")

	// Dashboard
	prot.Handle("/dashboard/stats", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.GetDashboardStats))).Methods("GET")

	// Kritis #2: Laporan Laba Rugi
	prot.Handle("/reports/profit", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.GetProfitReport))).Methods("GET")

	// Users
	prot.Handle("/users", middleware.RequireRole("super_admin")(http.HandlerFunc(handlers.GetUsers))).Methods("GET")
	prot.Handle("/users", middleware.RequireRole("super_admin")(http.HandlerFunc(handlers.CreateUser))).Methods("POST")
	prot.Handle("/users/{id}", middleware.RequireRole("super_admin")(http.HandlerFunc(handlers.UpdateUser))).Methods("PUT")
	prot.Handle("/users/{id}", middleware.RequireRole("super_admin")(http.HandlerFunc(handlers.DeleteUser))).Methods("DELETE")

	// Kritis #7: Login logs
	prot.Handle("/login-logs", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.GetLoginLogs))).Methods("GET")

	// Stock Mutations
	prot.Handle("/stock-mutations", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.GetStockMutations))).Methods("GET")
	prot.Handle("/stock-mutations", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.CreateStockMutation))).Methods("POST")

	// Discounts
	prot.Handle("/discounts", middleware.RequireRole("super_admin", "admin", "cashier")(http.HandlerFunc(handlers.GetDiscounts))).Methods("GET")
	prot.Handle("/discounts/validate/{code}", middleware.RequireRole("super_admin", "admin", "cashier")(http.HandlerFunc(handlers.ValidateDiscountCode))).Methods("GET")
	prot.Handle("/discounts", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.CreateDiscount))).Methods("POST")
	prot.Handle("/discounts/{id}", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.UpdateDiscount))).Methods("PUT")
	prot.Handle("/discounts/{id}", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.DeleteDiscount))).Methods("DELETE")

	// Settings
	prot.Handle("/settings", middleware.RequireRole("super_admin", "admin", "cashier")(http.HandlerFunc(handlers.GetSettings))).Methods("GET")
	prot.Handle("/settings", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.UpdateSettings))).Methods("PUT")
	prot.Handle("/settings/qris-image", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.DeleteQRISImage))).Methods("DELETE")

	// Export
	prot.Handle("/export/transactions", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.ExportTransactionsCSV))).Methods("GET")
	prot.Handle("/export/products", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.ExportProductsCSV))).Methods("GET")
	prot.Handle("/export/stock-mutations", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.ExportStockMutationsCSV))).Methods("GET")

	// Backup / Restore
	prot.Handle("/backup", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.BackupDatabase))).Methods("GET")
	prot.Handle("/restore", middleware.RequireRole("super_admin")(http.HandlerFunc(handlers.RestoreDatabase))).Methods("POST")

	// ── Penting #1: Laporan Shift ────────────────────────────────────────────────
	prot.Handle("/reports/shift", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.GetShiftReport))).Methods("GET")

	// ── Penting #3: Harga Grosir/Member ───────────────────────────────────────
	prot.Handle("/products/{product_id}/price-tiers", middleware.RequireRole("super_admin", "admin", "cashier")(http.HandlerFunc(handlers.GetPriceTiers))).Methods("GET")
	prot.Handle("/products/{product_id}/price-tiers", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.CreatePriceTier))).Methods("POST")
	prot.Handle("/products/{product_id}/tier-price", middleware.RequireRole("super_admin", "admin", "cashier")(http.HandlerFunc(handlers.GetProductTierPrice))).Methods("GET")
	prot.Handle("/price-tiers/{id}", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.DeletePriceTier))).Methods("DELETE")

	// ── Penting #5: Pelanggan & Hutang ────────────────────────────────────────
	prot.Handle("/customers", middleware.RequireRole("super_admin", "admin", "cashier")(http.HandlerFunc(handlers.GetCustomers))).Methods("GET")
	prot.Handle("/customers", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.CreateCustomer))).Methods("POST")
	prot.Handle("/customers/{id}", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.UpdateCustomer))).Methods("PUT")
	prot.Handle("/customers/{id}", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.DeleteCustomer))).Methods("DELETE")
	prot.Handle("/customers/{id}/debt", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.GetCustomerDebt))).Methods("GET")
	prot.Handle("/customers/debt-payment", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.RecordDebtPayment))).Methods("POST")

	// ── Penting #6: Supplier ──────────────────────────────────────────────────
	prot.Handle("/suppliers", middleware.RequireRole("super_admin", "admin", "cashier")(http.HandlerFunc(handlers.GetSuppliers))).Methods("GET")
	prot.Handle("/suppliers", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.CreateSupplier))).Methods("POST")
	prot.Handle("/suppliers/{id}", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.UpdateSupplier))).Methods("PUT")
	prot.Handle("/suppliers/{id}", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.DeleteSupplier))).Methods("DELETE")

	// ── Penting #9: Import Produk CSV ─────────────────────────────────────────
	prot.Handle("/import/products", middleware.RequireRole("super_admin", "admin")(http.HandlerFunc(handlers.ImportProductsCSV))).Methods("POST")
	prot.Handle("/import/products/template", middleware.RequireRole("super_admin", "admin", "cashier")(http.HandlerFunc(handlers.ExportProductsCSVTemplate))).Methods("GET")

	// ── SPA ────────────────────────────────────────────────────────────────────
	distFS, err := fs.Sub(frontendFiles, "frontend/dist")
	if err != nil {
		log.Fatalf("❌ Gagal load frontend: %v", err)
	}
	fileServer := http.FileServer(http.FS(distFS))

	// Read index.html once at startup for SPA fallback
	indexHTML, indexErr := fs.ReadFile(distFS, "index.html")
	if indexErr != nil {
		log.Fatalf("❌ index.html tidak ditemukan di dist/: %v", indexErr)
	}

	r.PathPrefix("/").HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		clean := req.URL.Path
		if clean == "/" || clean == "" {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
			w.Header().Set("Pragma", "no-cache")
			w.Header().Set("Expires", "0")
			w.Write(indexHTML)
			return
		}
		// Strip leading slash for embed FS lookup
		fsPath := clean[1:]
		if _, statErr := fs.Stat(distFS, fsPath); statErr != nil {
			// Not a static file → serve index.html for React Router
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
			w.Header().Set("Pragma", "no-cache")
			w.Header().Set("Expires", "0")
			w.Write(indexHTML)
			return
		}
		// Static asset exists → serve it directly with appropriate caching
		if req.URL.Path != "/sw.js" {
			// Cache static assets for 1 hour, except service worker
			w.Header().Set("Cache-Control", "public, max-age=3600")
		} else {
			// Service worker should not be cached
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		}
		fileServer.ServeHTTP(w, req)
	})

	localIP := getLocalIP()
	port := "8080"

	fmt.Println()
	fmt.Println("✅ Server berhasil dijalankan! (v3.1)")
	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	fmt.Printf("🖥️  Buka di PC ini        : http://localhost:%s\n", port)
	if localIP != "" {
		fmt.Printf("📱 Buka kasir di HP via  : http://%s:%s\n", localIP, port)
	}
	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	fmt.Println("🔑 Login default: admin / admin123")
	fmt.Println()

	go func() { time.Sleep(1 * time.Second); openBrowser("http://localhost:" + port) }()

	srv := &http.Server{
		Addr: "0.0.0.0:" + port, Handler: r,
		ReadTimeout: 60 * time.Second, WriteTimeout: 60 * time.Second, IdleTimeout: 120 * time.Second,
	}
	log.Fatal(srv.ListenAndServe())
}

func getLocalIP() string {
	ifaces, _ := net.Interfaces()
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, _ := iface.Addrs()
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}
			if ip == nil || ip.IsLoopback() {
				continue
			}
			ip = ip.To4()
			if ip == nil {
				continue
			}
			if ip[0] == 192 && ip[1] == 168 {
				return ip.String()
			}
		}
	}
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err != nil {
		return ""
	}
	defer conn.Close()
	return conn.LocalAddr().(*net.UDPAddr).IP.String()
}

func openBrowser(url string) {
	switch runtime.GOOS {
	case "windows":
		exec.Command("cmd", "/c", "start", url).Start()
	case "darwin":
		exec.Command("open", url).Start()
	default:
		exec.Command("xdg-open", url).Start()
	}
}
