package middleware

import (
	"testing"
	"time"
)

func TestLoginLimiterLocksAfterFiveFailures(t *testing.T) {
	now := time.Now()
	limiter := NewLoginLimiter()
	limiter.now = func() time.Time { return now }
	for i := 0; i < maxLoginFailures; i++ {
		limiter.Failed("k")
	}
	if limiter.Allowed("k") {
		t.Fatal("login should be locked")
	}
	now = now.Add(loginLockDuration)
	if !limiter.Allowed("k") {
		t.Fatal("login should unlock after lock duration")
	}
}
