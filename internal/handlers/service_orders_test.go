package handlers

import "testing"

func TestServiceOrderStatusesAreExplicit(t *testing.T) {
	for _, status := range []string{"received", "diagnosis", "awaiting_approval", "awaiting_parts", "in_progress", "ready", "completed", "cancelled"} {
		if !serviceStatuses[status] { t.Fatalf("status %q must be accepted", status) }
	}
	if serviceStatuses["paid"] || serviceStatuses["in-review"] || serviceStatuses[""] { t.Fatal("unknown service status must not be accepted") }
}
