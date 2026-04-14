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
	} `json:"data"`
}

type ProductRequest struct {
	Name        string  `json:"name"`
	BarcodeSKU  string  `json:"barcode_sku"`
	BuyPrice    float64 `json:"buy_price"`
	SellPrice   float64 `json:"sell_price"`
	Stock       int     `json:"stock"`
	CategoryID  *int64  `json:"category_id"`
	Description string  `json:"description"`
}

func main() {
	fmt.Println("🛠️ Adding sample products...")

	// Login
	token, err := login()
	if err != nil {
		fmt.Printf("❌ Login gagal: %v\n", err)
		return
	}
	fmt.Println("✅ Login berhasil")

	// Add sample products
	products := []ProductRequest{
		{
			Name:        "Aqua Botol 600ml",
			BarcodeSKU:  "8888001",
			BuyPrice:    3000,
			SellPrice:   4000,
			Stock:       1000,
			CategoryID:  nil,
			Description: "Air mineral botol",
		},
		{
			Name:        "Indomie Goreng",
			BarcodeSKU:  "8888002",
			BuyPrice:    2500,
			SellPrice:   3500,
			Stock:       500,
			CategoryID:  nil,
			Description: "Mie instant rasa ayam",
		},
		{
			Name:        "Kopi Sachet",
			BarcodeSKU:  "8888003",
			BuyPrice:    800,
			SellPrice:   1500,
			Stock:       200,
			CategoryID:  nil,
			Description: "Kopi sachet 3in1",
		},
	}

	for i, product := range products {
		err := addProduct(token, product)
		if err != nil {
			fmt.Printf("❌ Gagal tambah produk %d: %v\n", i+1, err)
		} else {
			fmt.Printf("✅ Produk %d ditambahkan: %s\n", i+1, product.Name)
		}
	}

	fmt.Println("🎉 Selesai! Sekarang coba test checkout lagi.")
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

func addProduct(token string, product ProductRequest) error {
	reqBody, _ := json.Marshal(product)

	client := &http.Client{}
	req, err := http.NewRequest("POST", API_BASE+"/products", bytes.NewBuffer(reqBody))
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
		var apiResp map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&apiResp)
		return fmt.Errorf("HTTP %d: %v", resp.StatusCode, apiResp["error"])
	}

	return nil
}
