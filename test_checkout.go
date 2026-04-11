package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

const API_BASE = "http://localhost:8080/api"

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Token string `json:"token"`
		User  struct {
			ID       int64  `json:"id"`
			Username string `json:"username"`
			Role     string `json:"role"`
		} `json:"user"`
	} `json:"data"`
}

type CheckoutRequest struct {
	Items         []CheckoutItem `json:"items"`
	PaymentAmount float64        `json:"payment_amount"`
	PaymentMethod string         `json:"payment_method"`
	CashAmount    float64        `json:"cash_amount"`
	QRISAmount    float64        `json:"qris_amount"`
	DiscountCode  string         `json:"discount_code"`
	CustomerID    int64          `json:"customer_id"`
	OnCredit      bool           `json:"on_credit"`
}

type CheckoutItem struct {
	ProductID int64 `json:"product_id"`
	Quantity  int   `json:"quantity"`
}

type Product struct {
	ID        int64   `json:"id"`
	Name      string  `json:"name"`
	SellPrice float64 `json:"sell_price"`
	Stock     int     `json:"stock"`
}

type GetProductsResponse struct {
	Success bool      `json:"success"`
	Data    []Product `json:"data"`
}

type APIResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error"`
	Message string `json:"message"`
}

func main() {
	fmt.Println("🧪 Testing checkout untuk mencari error 500...")

	// 1. Login dulu
	token, err := login()
	if err != nil {
		fmt.Printf("❌ Login gagal: %v\n", err)
		return
	}
	fmt.Println("✅ Login berhasil")

	// 2. Ambil produk pertama
	products, err := getProducts(token)
	if err != nil {
		fmt.Printf("❌ Get products gagal: %v\n", err)
		return
	}
	if len(products) == 0 {
		fmt.Println("❌ Tidak ada produk di database")
		return
	}

	product := products[0]
	fmt.Printf("✅ Produk ditemukan: %s (ID: %d, Harga: %.0f, Stok: %d)\n",
		product.Name, product.ID, product.SellPrice, product.Stock)

	// 3. Test checkout
	checkoutReq := CheckoutRequest{
		Items: []CheckoutItem{
			{ProductID: product.ID, Quantity: 1},
		},
		PaymentAmount: product.SellPrice,
		PaymentMethod: "cash",
		CashAmount:    product.SellPrice,
		QRISAmount:    0,
		DiscountCode:  "",
		CustomerID:    0,
		OnCredit:      false,
	}

	fmt.Println("🔄 Mencoba checkout...")
	err = testCheckout(token, checkoutReq)
	if err != nil {
		fmt.Printf("❌ Checkout error: %v\n", err)
	} else {
		fmt.Println("✅ Checkout berhasil")
	}
}

func login() (string, error) {
	reqBody, _ := json.Marshal(LoginRequest{
		Username: "admin",
		Password: "admin123",
	})

	resp, err := http.Post(API_BASE+"/login", "application/json", bytes.NewBuffer(reqBody))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var loginResp LoginResponse
	if err := json.NewDecoder(resp.Body).Decode(&loginResp); err != nil {
		return "", err
	}

	if !loginResp.Success {
		return "", fmt.Errorf("login failed")
	}

	return loginResp.Data.Token, nil
}

func getProducts(token string) ([]Product, error) {
	client := &http.Client{}
	req, err := http.NewRequest("GET", API_BASE+"/products", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var productsResp GetProductsResponse
	if err := json.NewDecoder(resp.Body).Decode(&productsResp); err != nil {
		return nil, err
	}

	if !productsResp.Success {
		return nil, fmt.Errorf("get products failed")
	}

	return productsResp.Data, nil
}

func testCheckout(token string, checkoutReq CheckoutRequest) error {
	reqBody, _ := json.Marshal(checkoutReq)

	client := &http.Client{}
	req, err := http.NewRequest("POST", API_BASE+"/checkout", bytes.NewBuffer(reqBody))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		var apiResp APIResponse
		json.NewDecoder(resp.Body).Decode(&apiResp)
		return fmt.Errorf("HTTP %d: %s", resp.StatusCode, apiResp.Error)
	}

	fmt.Println("✅ Checkout response OK")
	return nil
}
