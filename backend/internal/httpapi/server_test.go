package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/payrail-one/demo-store/backend/internal/payrail"
)

const merchant = "paydev1qzn5sxzyfr7zs37hlh2vk8zmc76qsvhk42z9duygfyhm9zz8kaqpqut57pl"
const merchantToken = "merchant-test-token-with-at-least-32-bytes"

func TestCreateOrderUsesAuthoritativeCatalogPrice(t *testing.T) {
	id := strings.Repeat("ab", 32)
	upstream := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/api/checkouts" {
			t.Fatalf("unexpected upstream path: %s", request.URL.Path)
		}
		var input map[string]string
		if err := json.NewDecoder(request.Body).Decode(&input); err != nil {
			t.Fatalf("decode upstream request: %v", err)
		}
		if input["amount"] != "77000000" || input["merchantAddress"] != merchant {
			t.Fatalf("server did not calculate the authoritative total: %#v", input)
		}
		_ = json.NewEncoder(writer).Encode(map[string]any{
			"id": id, "merchantLabel": "Aurora Market · Devnet", "merchantAddress": merchant,
			"amount": "77000000", "fee": "0", "status": "open", "paymentPath": "/pay/" + id,
			"asset": map[string]any{"id": strings.Repeat("22", 32), "symbol": "TEST", "decimals": 6},
		})
	}))
	defer upstream.Close()

	handler := testHandler(t, upstream)
	request := httptest.NewRequest(http.MethodPost, "/orders", strings.NewReader(`{"items":[{"productId":"orbit-lamp","quantity":2}]}`))
	request.Header.Set("content-type", "application/json")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusCreated {
		t.Fatalf("unexpected status %d: %s", response.Code, response.Body.String())
	}
	var order struct {
		TotalAtomic string `json:"totalAtomic"`
		PaymentURL  string `json:"paymentUrl"`
	}
	if err := json.NewDecoder(response.Body).Decode(&order); err != nil {
		t.Fatalf("decode order: %v", err)
	}
	if order.TotalAtomic != "77000000" || order.PaymentURL != "https://wallet.payrail.one/pay/"+id {
		t.Fatalf("unexpected order: %#v", order)
	}
}

func TestCreateOrderRejectsClientPriceAndDuplicateProduct(t *testing.T) {
	upstream := httptest.NewServer(http.NotFoundHandler())
	defer upstream.Close()
	handler := testHandler(t, upstream)
	tests := []string{
		`{"items":[{"productId":"orbit-lamp","quantity":1}],"totalAtomic":"1"}`,
		`{"items":[{"productId":"orbit-lamp","quantity":1},{"productId":"orbit-lamp","quantity":1}]}`,
	}
	for _, body := range tests {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/orders", strings.NewReader(body)))
		if response.Code < 400 || response.Code >= 500 {
			t.Fatalf("expected client error for %s, got %d", body, response.Code)
		}
	}
}

func TestApprovalCodeClaimStaysServerSide(t *testing.T) {
	id := strings.Repeat("ab", 32)
	upstream := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/api/checkouts/"+id+"/approval-code" {
			t.Fatalf("unexpected upstream path: %s", request.URL.Path)
		}
		if request.Header.Get("authorization") != "Bearer "+merchantToken {
			t.Fatal("merchant credential was not forwarded in the authorization header")
		}
		var input map[string]string
		if err := json.NewDecoder(request.Body).Decode(&input); err != nil {
			t.Fatalf("decode claim: %v", err)
		}
		if input["code"] != "004219" {
			t.Fatalf("unexpected code payload: %#v", input)
		}
		_ = json.NewEncoder(writer).Encode(map[string]string{"status": "claimed", "checkoutId": id})
	}))
	defer upstream.Close()
	handler := testHandler(t, upstream)
	request := httptest.NewRequest(http.MethodPost, "/orders/"+id+"/approval-code", strings.NewReader(`{"code":"004219"}`))
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("unexpected status %d: %s", response.Code, response.Body.String())
	}
}

func testHandler(t *testing.T, upstream *httptest.Server) http.Handler {
	t.Helper()
	client, err := payrail.NewClient(upstream.URL, upstream.Client())
	if err != nil {
		t.Fatalf("create Payrail client: %v", err)
	}
	server, err := New(Config{
		Payrail: client, MerchantAddress: merchant, MerchantToken: merchantToken,
		WalletOrigin: "https://wallet.payrail.one",
	})
	if err != nil {
		t.Fatalf("create store server: %v", err)
	}
	return server.Handler()
}
