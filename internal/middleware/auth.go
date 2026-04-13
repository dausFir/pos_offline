package middleware

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"kasir-umkm/internal/models"

	"github.com/golang-jwt/jwt/v5"
)

var jwtSecret []byte

// InitializeJWT initializes JWT secret from environment variable or generates a secure default
func InitializeJWT() {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		log.Println("⚠️  WARNING: JWT_SECRET environment variable not set")
		log.Println("⚠️  Using default secret - CHANGE THIS IN PRODUCTION!")
		secret = "kasir-umkm-super-secret-key-2024-ganti-di-production"
	}

	if len(secret) < 32 {
		log.Fatalf("❌ JWT_SECRET must be at least 32 characters long")
	}

	jwtSecret = []byte(secret)
	log.Printf("✅ JWT secret initialized (%d characters)", len(secret))
}

// GetJWTSecret returns the JWT secret
func GetJWTSecret() []byte {
	return jwtSecret
}

// Access token duration: 30 minutes (short-lived)
const AccessTokenDuration = 30 * time.Minute

// Refresh token duration: 30 days
const RefreshTokenDuration = 30 * 24 * time.Hour

type Claims struct {
	UserID   int64  `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

type contextKey string

const UserContextKey contextKey = "user"

func GenerateAccessToken(user models.User) (string, error) {
	claims := Claims{
		UserID:   user.ID,
		Username: user.Username,
		Role:     user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(AccessTokenDuration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(GetJWTSecret())
}

func GenerateRefreshToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

func HashRefreshToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}

// Legacy function for backward compatibility
func GenerateToken(user models.User) (string, error) {
	return GenerateAccessToken(user)
}

func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			writeError(w, http.StatusUnauthorized, "Token tidak ditemukan")
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			writeError(w, http.StatusUnauthorized, "Format token tidak valid")
			return
		}

		tokenStr := parts[1]
		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
			return GetJWTSecret(), nil
		})

		if err != nil || !token.Valid {
			writeError(w, http.StatusUnauthorized, "Token tidak valid atau sudah kadaluarsa")
			return
		}

		ctx := context.WithValue(r.Context(), UserContextKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func RequireRole(roles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := r.Context().Value(UserContextKey).(*Claims)
			if !ok {
				writeError(w, http.StatusUnauthorized, "Akses ditolak")
				return
			}
			for _, role := range roles {
				if claims.Role == role {
					next.ServeHTTP(w, r)
					return
				}
			}
			writeError(w, http.StatusForbidden, "Anda tidak memiliki akses ke fitur ini")
		})
	}
}

func GetClaims(r *http.Request) *Claims {
	claims, _ := r.Context().Value(UserContextKey).(*Claims)
	return claims
}

func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		w.Header().Set("Access-Control-Max-Age", "86400")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(models.APIResponse{Success: false, Error: msg})
}
