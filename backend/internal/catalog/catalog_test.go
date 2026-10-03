package catalog

import (
	"errors"
	"testing"
)

func TestCalculateUsesAuthoritativeAtomicPrices(t *testing.T) {
	lines, total, err := Calculate([]Item{{ProductID: "orbit-lamp", Quantity: 2}, {ProductID: "field-notebook", Quantity: 1}})
	if err != nil {
		t.Fatalf("calculate cart: %v", err)
	}
	if total != 89_000_000 {
		t.Fatalf("unexpected total: %d", total)
	}
	if lines[0].TotalAtomic != "77000000" {
		t.Fatalf("unexpected first line total: %s", lines[0].TotalAtomic)
	}
}

func TestCalculateRejectsDuplicateAndBoundaryQuantities(t *testing.T) {
	_, _, duplicate := Calculate([]Item{{ProductID: "orbit-lamp", Quantity: 1}, {ProductID: "orbit-lamp", Quantity: 1}})
	if !errors.Is(duplicate, ErrDuplicateItem) {
		t.Fatalf("expected duplicate error, got %v", duplicate)
	}
	_, _, quantity := Calculate([]Item{{ProductID: "orbit-lamp", Quantity: 6}})
	if !errors.Is(quantity, ErrInvalidQuantity) {
		t.Fatalf("expected quantity error, got %v", quantity)
	}
}
