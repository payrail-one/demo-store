# Payrail demo store

A complete, public reference storefront for Payrail checkout. The repository keeps the [Workstar](https://github.com/wslab-ai/workstar) frontend and Go backend together so an integration can be inspected, run, and deployed as one unit.

Live demo: [store.payrail.one](https://store.payrail.one) · Merchant portal: [merchant.payrail.one](https://merchant.payrail.one) · SDK: [payrail-one/sdk](https://github.com/payrail-one/sdk)

> This deployment uses a development network and `TEST` units. They have no monetary value.

## What it demonstrates

- the Go backend owns the catalog and calculates every amount using checked integer atomic units;
- the browser sends only product identifiers and bounded quantities;
- the backend creates the Payrail checkout and verifies the returned recipient, amount, identifier, path, and state;
- `@payrail-one/sdk` independently validates the checkout in the browser and waits for finality;
- Payrail Code renders the payment request as a branded circular token and keeps a standard high-error-correction QR available as a camera fallback;
- wallet keys and signed operations never enter the store frontend or backend.

The circular Payrail Code is a deterministic visual payment token for the Payrail experience. Until the Payrail wallet ships its dedicated radial decoder, customers should tap the payment link or expand the standard camera QR fallback. It is not an Apple App Clip code or an EMV-certified QR profile.

## Run locally

Requirements: Node.js `22.22.0`, npm, and Go `1.24.9`.

```bash
npm ci
cd backend
PAYRAIL_GATEWAY_URL=https://r1.verita.tech/payrail \
PAYRAIL_STORE_MERCHANT_ADDRESS=paydev1qzn5sxzyfr7zs37hlh2vk8zmc76qsvhk42z9duygfyhm9zz8kaqpqut57pl \
go run ./cmd/server
```

In a second terminal:

```bash
DEVNET_API_PROXY=https://r1.verita.tech/payrail npm run dev
```

Open `http://127.0.0.1:4193`. The frontend proxies `/store` to the Go API and `/api` to the Payrail gateway during development.

## Verify

```bash
npm run format:check
npm run check
npm run build
cd backend && gofmt -l . && go vet ./... && go test -race ./...
docker build -f backend/Dockerfile -t payrail-demo-store:local .
```

## Integrate the SDK

The repository pins the SDK to an audited Git commit. A minimal browser integration looks like this:

```ts
import { PayrailCheckout } from '@payrail-one/sdk';

const payrail = new PayrailCheckout({
  apiBaseUrl: '/api',
  merchantAddress: catalog.merchantAddress,
});

const payment = await payrail.payment(order.checkout.id);
const receipt = await payrail.waitForFinalization(payment.checkout.id);
```

Create orders on your own backend. Do not accept a price, total, merchant address, or finality assertion from the browser.

## Deployment model

`store.payrail.one` is a static Cloudflare Worker frontend. It exposes only the narrow store and checkout-status routes declared in `frontend/src/worker.ts`. The Go service runs on a designated Payrail server and reaches the gateway over its private network. The production service is read-only, unprivileged, capability-free, and bound behind the edge proxy.

Copy `.env.example` to `.env` for the local container configuration. Never commit private keys or credentials; the configured demo recipient is a public address only.

## License

Apache-2.0. See `LICENSE` and `NOTICE`.
