package middleware

import (
	"sync"
	"time"
)

const maxLoginFailures = 5
const loginLockDuration = 15 * time.Minute

type loginAttempt struct {
	failures    int
	lockedUntil time.Time
	last        time.Time
}
type LoginLimiter struct {
	mu      sync.Mutex
	entries map[string]loginAttempt
	now     func() time.Time
}

func NewLoginLimiter() *LoginLimiter {
	return &LoginLimiter{entries: map[string]loginAttempt{}, now: time.Now}
}
func (l *LoginLimiter) Allowed(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	a := l.entries[key]
	return !l.now().Before(a.lockedUntil)
}
func (l *LoginLimiter) Failed(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	a := l.entries[key]
	now := l.now()
	if now.Sub(a.last) > loginLockDuration {
		a.failures = 0
	}
	a.failures++
	a.last = now
	if a.failures >= maxLoginFailures {
		a.lockedUntil = now.Add(loginLockDuration)
		a.failures = 0
	}
	l.entries[key] = a
}
func (l *LoginLimiter) Succeeded(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.entries, key)
}

var defaultLoginLimiter = NewLoginLimiter()

func LoginAllowed(key string) bool  { return defaultLoginLimiter.Allowed(key) }
func RecordLoginFailure(key string) { defaultLoginLimiter.Failed(key) }
func ClearLoginFailures(key string) { defaultLoginLimiter.Succeeded(key) }
