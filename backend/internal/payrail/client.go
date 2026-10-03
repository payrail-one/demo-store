package payrail

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

const maxResponseBytes = 1 << 20

var checkoutID = regexp.MustCompile(`^[0-9a-f]{64}$`)

var ErrInvariant = errors.New("payrail checkout invariant failed")

type Asset struct {
	ID       string `json:"id"`
	Symbol   string `json:"symbol"`
	Decimals uint8  `json:"decimals"`
}

type Transaction struct {
	ID             string `json:"id"`
	BlockHeight    string `json:"blockHeight"`
	OperationIndex string `json:"operationIndex"`
	From           string `json:"from"`
	To             string `json:"to"`
	Amount         string `json:"amount"`
	Fee            string `json:"fee"`
	Outcome        string `json:"outcome"`
}

type Checkout struct {
	ID               string       `json:"id"`
	MerchantLabel    string       `json:"merchantLabel"`
	MerchantAddress  string       `json:"merchantAddress"`
	Amount           string       `json:"amount"`
	Fee              string       `json:"fee"`
	Asset            Asset        `json:"asset"`
	Status           string       `json:"status"`
	ExpiresAtMS      string       `json:"expiresAtMs"`
	ValidUntilHeight string       `json:"validUntilHeight"`
	PaymentPath      string       `json:"paymentPath"`
	SMSText          string       `json:"smsText"`
	Transaction      *Transaction `json:"transaction"`
}

type NetworkStatus struct {
	NetworkID       string `json:"networkId"`
	AddressPrefix   string `json:"addressPrefix"`
	FinalizedHeight string `json:"finalizedHeight"`
	FinalityMode    string `json:"finalityMode"`
	Asset           Asset  `json:"asset"`
}

type Client struct {
	baseURL *url.URL
	http    *http.Client
}

func NewClient(rawURL string, client *http.Client) (*Client, error) {
	baseURL, err := url.Parse(strings.TrimRight(rawURL, "/"))
	if err != nil || (baseURL.Scheme != "http" && baseURL.Scheme != "https") || baseURL.Host == "" {
		return nil, errors.New("PAYRAIL_GATEWAY_URL must be an absolute HTTP URL")
	}
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	return &Client{baseURL: baseURL, http: client}, nil
}

func (client *Client) Status(ctx context.Context) (NetworkStatus, error) {
	var status NetworkStatus
	err := client.request(ctx, http.MethodGet, "/api/status", nil, &status)
	return status, err
}

func (client *Client) CreateCheckout(ctx context.Context, merchant, amount, reference string) (Checkout, error) {
	payload := struct {
		MerchantAddress string `json:"merchantAddress"`
		Amount          string `json:"amount"`
		OrderReference  string `json:"orderReference"`
	}{MerchantAddress: merchant, Amount: amount, OrderReference: reference}
	var checkout Checkout
	if err := client.request(ctx, http.MethodPost, "/api/checkouts", payload, &checkout); err != nil {
		return Checkout{}, err
	}
	if err := validateCheckout(checkout, merchant, amount); err != nil {
		return Checkout{}, err
	}
	if checkout.Status != "open" {
		return Checkout{}, fmt.Errorf("%w: new checkout is not open", ErrInvariant)
	}
	return checkout, nil
}

func (client *Client) Checkout(ctx context.Context, id, merchant string) (Checkout, error) {
	if !checkoutID.MatchString(id) {
		return Checkout{}, fmt.Errorf("%w: malformed checkout identifier", ErrInvariant)
	}
	var checkout Checkout
	if err := client.request(ctx, http.MethodGet, "/api/checkouts/"+id, nil, &checkout); err != nil {
		return Checkout{}, err
	}
	if err := validateCheckout(checkout, merchant, checkout.Amount); err != nil {
		return Checkout{}, err
	}
	return checkout, nil
}

func validateCheckout(checkout Checkout, merchant, amount string) error {
	if !checkoutID.MatchString(checkout.ID) || checkout.MerchantAddress != merchant || checkout.Amount != amount {
		return fmt.Errorf("%w: recipient, amount or identifier changed", ErrInvariant)
	}
	if checkout.PaymentPath != "/pay/"+checkout.ID {
		return fmt.Errorf("%w: non-canonical payment path", ErrInvariant)
	}
	if checkout.Status != "open" && checkout.Status != "processing" && checkout.Status != "finalized" && checkout.Status != "expired" {
		return fmt.Errorf("%w: unsupported checkout status", ErrInvariant)
	}
	return nil
}

func (client *Client) request(ctx context.Context, method, path string, payload, output any) error {
	target := *client.baseURL
	target.Path = strings.TrimRight(target.Path, "/") + path
	var body io.Reader
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			return fmt.Errorf("encode Payrail request: %w", err)
		}
		body = bytes.NewReader(encoded)
	}
	request, err := http.NewRequestWithContext(ctx, method, target.String(), body)
	if err != nil {
		return fmt.Errorf("create Payrail request: %w", err)
	}
	request.Header.Set("accept", "application/json")
	if payload != nil {
		request.Header.Set("content-type", "application/json")
	}
	response, err := client.http.Do(request)
	if err != nil {
		return fmt.Errorf("call Payrail: %w", err)
	}
	defer response.Body.Close()
	limited := io.LimitReader(response.Body, maxResponseBytes)
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		message, _ := io.ReadAll(limited)
		return fmt.Errorf("Payrail returned %d: %s", response.StatusCode, strings.TrimSpace(string(message)))
	}
	decoder := json.NewDecoder(limited)
	if err := decoder.Decode(output); err != nil {
		return fmt.Errorf("decode Payrail response: %w", err)
	}
	return nil
}
