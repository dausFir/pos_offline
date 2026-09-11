package handlers

import "testing"

func TestServiceOrderStatusesAreExplicit(t *testing.T) {
	for _, status := range []string{"received", "diagnosis", "awaiting_approval", "awaiting_parts", "in_progress", "ready", "completed", "cancelled"} {
		if !serviceStatuses[status] { t.Fatalf("status %q must be accepted", status) }
	}
	if serviceStatuses["paid"] || serviceStatuses["in-review"] || serviceStatuses[""] { t.Fatal("unknown service status must not be accepted") }
}

func TestServiceOrderTransitionsProtectTerminalStates(t *testing.T) {
	if !CanTransitionServiceOrder("received", "diagnosis") {
		t.Fatal("received order must be able to enter diagnosis")
	}
	if CanTransitionServiceOrder("received", "completed") {
		t.Fatal("completed must only be set through final invoicing")
	}
	if CanTransitionServiceOrder("cancelled", "in_progress") || CanTransitionServiceOrder("completed", "ready") {
		t.Fatal("terminal service states must not be reopened")
	}
	if canFinalizeServiceOrder("cancelled") || canFinalizeServiceOrder("in_progress") || !canFinalizeServiceOrder("ready") {
		t.Fatal("only a ready service order may be finalised")
	}
}
