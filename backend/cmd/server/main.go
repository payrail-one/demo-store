package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/payrail-one/demo-store/backend/internal/httpapi"
	"github.com/payrail-one/demo-store/backend/internal/payrail"
)

func main() {
	client, err := payrail.NewClient(environment("PAYRAIL_GATEWAY_URL", "https://devnet.payrail.one"), nil)
	if err != nil {
		log.Fatalf("configure Payrail client: %v", err)
	}
	api, err := httpapi.New(httpapi.Config{
		Payrail:         client,
		MerchantAddress: os.Getenv("PAYRAIL_STORE_MERCHANT_ADDRESS"),
		WalletOrigin:    environment("PAYRAIL_WALLET_ORIGIN", "https://wallet.payrail.one"),
	})
	if err != nil {
		log.Fatalf("configure store API: %v", err)
	}
	server := &http.Server{
		Addr:              environment("PAYRAIL_STORE_BIND", "127.0.0.1:18082"),
		Handler:           api.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	errCh := make(chan error, 1)
	go func() { errCh <- server.ListenAndServe() }()
	select {
	case <-ctx.Done():
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdown); err != nil {
			log.Printf("graceful shutdown failed: %v", err)
		}
	case err := <-errCh:
		if !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("serve store API: %v", err)
		}
	}
}

func environment(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}
