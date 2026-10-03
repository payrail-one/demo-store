package payrail

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

const testMerchant = "paydev1qzn5sxzyfr7zs37hlh2vk8zmc76qsvhk42z9duygfyhm9zz8kaqpqut57pl"

func TestCreateCheckoutValidatesImmutableResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		var input map[string]string
		if err := json.NewDecoder(request.Body).Decode(&input); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if input["amount"] != "38500000" || input["merchantAddress"] != testMerchant {
			t.Fatalf("unexpected checkout request: %#v", input)
		}
		_ = json.NewEncoder(writer).Encode(testCheckout("38500000"))
	}))
	defer server.Close()
	client, err := NewClient(server.URL, server.Client())
	if err != nil {
		t.Fatalf("create client: %v", err)
	}
	checkout, err := client.CreateCheckout(context.Background(), testMerchant, "38500000", "aurora_order")
	if err != nil {
		t.Fatalf("create checkout: %v", err)
	}
	if checkout.Status != "open" {
		t.Fatalf("unexpected status: %s", checkout.Status)
	}
}

func TestCreateCheckoutRejectsChangedAmount(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(writer).Encode(testCheckout("1"))
	}))
	defer server.Close()
	client, err := NewClient(server.URL, server.Client())
	if err != nil {
		t.Fatalf("create client: %v", err)
	}
	_, err = client.CreateCheckout(context.Background(), testMerchant, "38500000", "aurora_order")
	if !errors.Is(err, ErrInvariant) {
		t.Fatalf("expected invariant error, got %v", err)
	}
}

func testCheckout(amount string) Checkout {
	id := strings.Repeat("ab", 32)
	return Checkout{
		ID:              id,
		MerchantLabel:   "Aurora Market · Devnet",
		MerchantAddress: testMerchant,
		Amount:          amount,
		Fee:             "0",
		Status:          "open",
		PaymentPath:     "/pay/" + id,
	}
}
