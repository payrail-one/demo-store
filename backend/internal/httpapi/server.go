package httpapi

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/payrail-one/demo-store/backend/internal/catalog"
	"github.com/payrail-one/demo-store/backend/internal/payrail"
)

const maxRequestBytes = 16 << 10

type Config struct {
	Payrail         *payrail.Client
	MerchantAddress string
	WalletOrigin    string
}

type Server struct {
	payrail         *payrail.Client
	merchantAddress string
	walletOrigin    *url.URL
}

type orderView struct {
	Checkout    payrail.Checkout `json:"checkout"`
	Lines       []catalog.Line   `json:"lines,omitempty"`
	TotalAtomic string           `json:"totalAtomic"`
	PaymentURL  string           `json:"paymentUrl"`
}

func New(config Config) (*Server, error) {
	if config.Payrail == nil {
		return nil, errors.New("Payrail client is required")
	}
	if strings.TrimSpace(config.MerchantAddress) == "" {
		return nil, errors.New("merchant address is required")
	}
	walletOrigin, err := url.Parse(config.WalletOrigin)
	if err != nil || walletOrigin.Scheme != "https" || walletOrigin.Host == "" {
		return nil, errors.New("wallet origin must be an absolute HTTPS URL")
	}
	return &Server{payrail: config.Payrail, merchantAddress: config.MerchantAddress, walletOrigin: walletOrigin}, nil
}

func (server *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/health/live", server.live)
	mux.HandleFunc("/health/ready", server.ready)
	mux.HandleFunc("/catalog", server.catalog)
	mux.HandleFunc("/orders", server.orders)
	mux.HandleFunc("/orders/", server.order)
	return securityHeaders(mux)
}

func (server *Server) live(writer http.ResponseWriter, request *http.Request) {
	if !requireMethod(writer, request, http.MethodGet) {
		return
	}
	writeJSON(writer, http.StatusOK, map[string]string{"status": "live"})
}

func (server *Server) ready(writer http.ResponseWriter, request *http.Request) {
	if !requireMethod(writer, request, http.MethodGet) {
		return
	}
	status, err := server.payrail.Status(request.Context())
	if err != nil {
		writeError(writer, http.StatusServiceUnavailable, "Payrail upstream is unavailable")
		return
	}
	writeJSON(writer, http.StatusOK, map[string]string{"status": "ready", "finalizedHeight": status.FinalizedHeight})
}

func (server *Server) catalog(writer http.ResponseWriter, request *http.Request) {
	if !requireMethod(writer, request, http.MethodGet) {
		return
	}
	status, err := server.payrail.Status(request.Context())
	if err != nil {
		writeError(writer, http.StatusBadGateway, "Unable to load Payrail network status")
		return
	}
	writeJSON(writer, http.StatusOK, struct {
		MerchantAddress string                `json:"merchantAddress"`
		Products        []catalog.Product     `json:"products"`
		Network         payrail.NetworkStatus `json:"network"`
	}{MerchantAddress: server.merchantAddress, Products: catalog.Products(), Network: status})
}

func (server *Server) orders(writer http.ResponseWriter, request *http.Request) {
	if !requireMethod(writer, request, http.MethodPost) {
		return
	}
	request.Body = http.MaxBytesReader(writer, request.Body, maxRequestBytes)
	var input struct {
		Items []catalog.Item `json:"items"`
	}
	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		writeError(writer, http.StatusBadRequest, "Invalid cart payload")
		return
	}
	lines, total, err := catalog.Calculate(input.Items)
	if err != nil {
		writeError(writer, http.StatusUnprocessableEntity, err.Error())
		return
	}
	reference, err := orderReference()
	if err != nil {
		writeError(writer, http.StatusInternalServerError, "Unable to create order reference")
		return
	}
	amount := strconv.FormatUint(total, 10)
	checkout, err := server.payrail.CreateCheckout(request.Context(), server.merchantAddress, amount, reference)
	if err != nil {
		writeError(writer, http.StatusBadGateway, "Unable to create Payrail checkout")
		return
	}
	writeJSON(writer, http.StatusCreated, server.orderView(checkout, lines, amount))
}

func (server *Server) order(writer http.ResponseWriter, request *http.Request) {
	if !requireMethod(writer, request, http.MethodGet) {
		return
	}
	id := strings.TrimPrefix(request.URL.Path, "/orders/")
	if id == "" || strings.Contains(id, "/") {
		writeError(writer, http.StatusNotFound, "Order was not found")
		return
	}
	checkout, err := server.payrail.Checkout(request.Context(), id, server.merchantAddress)
	if err != nil {
		writeError(writer, http.StatusBadGateway, "Unable to load Payrail checkout")
		return
	}
	writeJSON(writer, http.StatusOK, server.orderView(checkout, nil, checkout.Amount))
}

func (server *Server) orderView(checkout payrail.Checkout, lines []catalog.Line, total string) orderView {
	payment := *server.walletOrigin
	payment.Path = checkout.PaymentPath
	payment.RawQuery = ""
	payment.Fragment = ""
	return orderView{Checkout: checkout, Lines: lines, TotalAtomic: total, PaymentURL: payment.String()}
}

func orderReference() (string, error) {
	var entropy [8]byte
	if _, err := rand.Read(entropy[:]); err != nil {
		return "", fmt.Errorf("read randomness: %w", err)
	}
	return "aurora_" + strconv.FormatInt(time.Now().UTC().UnixMilli(), 36) + "_" + hex.EncodeToString(entropy[:]), nil
}

func requireMethod(writer http.ResponseWriter, request *http.Request, method string) bool {
	if request.Method == method {
		return true
	}
	writer.Header().Set("allow", method)
	writeError(writer, http.StatusMethodNotAllowed, "Method not allowed")
	return false
}

func writeError(writer http.ResponseWriter, status int, message string) {
	writeJSON(writer, status, map[string]string{"error": message})
}

func writeJSON(writer http.ResponseWriter, status int, value any) {
	writer.Header().Set("content-type", "application/json; charset=utf-8")
	writer.Header().Set("cache-control", "no-store")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(value)
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("x-content-type-options", "nosniff")
		writer.Header().Set("referrer-policy", "no-referrer")
		next.ServeHTTP(writer, request)
	})
}
