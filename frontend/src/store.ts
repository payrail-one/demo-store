import { PayrailCheckout, type Checkout } from '@payrail-one/sdk';
import { attr, html, on, repeat, signal } from 'workstar';
import { type Catalog, type Product, StoreApi, type StoreOrder } from './api';
import { formatAtomic, sumCartAtomic } from './money';
import { payrailScan } from './payrail-scan';

type PaymentStage = 'cart' | 'creating' | 'awaiting' | 'finalized' | 'failed';

export function createStore() {
  const api = new StoreApi();
  const catalog = signal<Catalog | null>(null);
  const quantities = signal(new Map<string, number>());
  const order = signal<StoreOrder | null>(null);
  const checkout = signal<Checkout | null>(null);
  const stage = signal<PaymentStage>('cart');
  const message = signal('Connecting to the Payrail development network…');
  let polling: AbortController | null = null;

  const load = async () => {
    try {
      catalog.value = await api.catalog();
      message.value = `Devnet online · block #${catalog.value.network.finalizedHeight}`;
    } catch (error) {
      stage.value = 'failed';
      message.value = errorMessage(error);
    }
  };

  const changeQuantity = (productId: string, delta: number) => {
    const next = new Map(quantities.value);
    const quantity = Math.max(
      0,
      Math.min(5, (next.get(productId) ?? 0) + delta),
    );
    if (quantity === 0) next.delete(productId);
    else next.set(productId, quantity);
    quantities.value = next;
  };

  const startCheckout = async () => {
    const current = catalog.value;
    if (!current || quantities.value.size === 0) return;
    stage.value = 'creating';
    message.value = 'Creating an immutable checkout on Payrail…';
    try {
      const created = await api.createOrder(
        [...quantities.value].map(([productId, quantity]) => ({
          productId,
          quantity,
        })),
      );
      const sdk = new PayrailCheckout({
        apiBaseUrl: '/api',
        merchantAddress: current.merchantAddress,
      });
      const session = await sdk.payment(created.checkout.id);
      if (
        session.checkout.amount !== created.totalAtomic ||
        session.paymentUrl !== created.paymentUrl
      ) {
        throw new Error('Checkout integrity verification failed.');
      }
      order.value = created;
      checkout.value = session.checkout;
      stage.value = 'awaiting';
      message.value = 'Scan the code or open the secure wallet to pay.';
      polling = new AbortController();
      void sdk
        .waitForFinalization(created.checkout.id, {
          intervalMs: 2_000,
          timeoutMs: 15 * 60_000,
          signal: polling.signal,
          onUpdate: (update) => (checkout.value = update),
        })
        .then((finalized) => {
          checkout.value = finalized.checkout;
          stage.value = 'finalized';
          message.value = 'Payment finalized independently by the network.';
        })
        .catch((error: unknown) => {
          if (polling?.signal.aborted) return;
          stage.value = 'failed';
          message.value = errorMessage(error);
        });
    } catch (error) {
      stage.value = 'failed';
      message.value = errorMessage(error);
    }
  };

  const closeCheckout = () => {
    polling?.abort();
    polling = null;
    order.value = null;
    checkout.value = null;
    stage.value = 'cart';
    message.value = catalog.value
      ? `Devnet online · block #${catalog.value.network.finalizedHeight}`
      : 'Ready.';
  };

  const resetOrder = () => {
    closeCheckout();
    quantities.value = new Map();
  };

  void load();

  return html`<div class="site-shell">
    <header class="topbar">
      <a class="brand" href="https://payrail.one" aria-label="Payrail home">
        <span class="brand-mark">P</span><span>PAYRAIL</span>
      </a>
      <nav aria-label="Store navigation">
        <a href="#collection">Collection</a>
        <a href="https://merchant.payrail.one">Merchant portal ↗</a>
        <a href="https://github.com/payrail-one/demo-store">Source ↗</a>
      </nav>
      <button
        class="cart-pill"
        type="button"
        ${on('click', () => scrollCart())}
      >
        Bag
        <span data-testid="cart-count"
          >${() => itemCount(quantities.value)}</span
        >
      </button>
    </header>

    <main>
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow">A working Payrail reference store · DEVNET</p>
          <h1>Objects for a<br /><em>slower orbit.</em></h1>
          <p class="lede">
            A small collection of useful things. The checkout is real: a Go
            backend fixes the amount, the public SDK verifies it, and Payrail
            returns a finalized receipt.
          </p>
          <a class="hero-link" href="#collection">Explore the collection ↓</a>
        </div>
        <div class="hero-object" aria-hidden="true">
          <span class="orbit orbit-one"></span>
          <span class="orbit orbit-two"></span>
          <span class="sphere"></span>
          <small>EDITION<br />01—04</small>
        </div>
      </section>

      <section class="network-strip" role="status">
        <span><i></i>${message}</span>
        <span
          >${() => catalog.value?.network.asset.symbol ?? 'TEST'}
          settlement</span
        >
        <span>Independent finality</span>
      </section>

      <section class="collection" id="collection">
        <div class="section-heading">
          <div>
            <p class="eyebrow">The collection</p>
            <h2>Four quiet essentials.</h2>
          </div>
          <p>
            Designed as a complete, inspectable checkout integration—not a
            mocked storefront.
          </p>
        </div>
        <div class="product-grid" data-testid="catalog">
          ${() =>
            catalog.value
              ? repeat(
                  catalog.value.products,
                  (product) => product.id,
                  (product) =>
                    productCard(
                      product.value,
                      productIndex(product.value.id),
                      catalog.value!,
                      () => quantities.value.get(product.value.id) ?? 0,
                      changeQuantity,
                    ),
                )
              : loadingCards()}
        </div>
      </section>

      ${() =>
        catalog.value
          ? cartPanel(
              catalog.value,
              quantities.value,
              startCheckout,
              stage.value,
            )
          : null}
    </main>

    <footer>
      <a class="brand" href="https://payrail.one"
        ><span class="brand-mark">P</span><span>PAYRAIL</span></a
      >
      <p>Open reference implementation · Workstar + Go + Payrail SDK</p>
      <p>Development network · no real funds</p>
    </footer>

    ${() =>
      order.value && checkout.value
        ? paymentModal(
            order.value,
            checkout.value,
            stage.value,
            closeCheckout,
            resetOrder,
          )
        : null}
  </div>`;
}

function productCard(
  product: Product,
  index: number,
  catalog: Catalog,
  quantity: () => number,
  change: (id: string, delta: number) => void,
) {
  return html`<article class="product-card" ${attr('data-tone', product.tone)}>
    <div ${attr('class', `product-visual visual-${index + 1}`)}>
      <span class="product-shape"></span><small>${product.edition}</small>
    </div>
    <div class="product-info">
      <p>${product.category}</p>
      <h3>${product.name}</h3>
      <span>${product.description}</span>
      <div class="product-buy">
        <strong
          >${formatAtomic(
            product.priceAtomic,
            catalog.network.asset.decimals,
            catalog.network.asset.symbol,
          )}</strong
        >
        <div
          class="quantity"
          ${attr('data-active', () => (quantity() > 0 ? 'true' : 'false'))}
        >
          <button
            type="button"
            ${attr('aria-label', `Remove one ${product.name}`)}
            ${attr('disabled', () => quantity() === 0)}
            ${on('click', () => change(product.id, -1))}
          >
            −
          </button>
          <span>${quantity}</span>
          <button
            type="button"
            ${attr('data-testid', `add-${product.id}`)}
            ${attr('aria-label', `Add one ${product.name}`)}
            ${attr('disabled', () => quantity() === 5)}
            ${on('click', () => change(product.id, 1))}
          >
            +
          </button>
        </div>
      </div>
    </div>
  </article>`;
}

function cartPanel(
  catalog: Catalog,
  quantities: ReadonlyMap<string, number>,
  checkout: () => Promise<void>,
  stage: PaymentStage,
) {
  const prices = new Map(
    catalog.products.map((product) => [product.id, product.priceAtomic]),
  );
  const total = sumCartAtomic(prices, quantities);
  const empty = quantities.size === 0;
  return html`<section class="cart-panel" id="bag" data-testid="cart">
    <div>
      <p class="eyebrow">Your bag</p>
      <h2>
        ${empty
          ? 'Choose an object.'
          : `${itemCount(quantities)} item${itemCount(quantities) === 1 ? '' : 's'} selected.`}
      </h2>
    </div>
    <div class="cart-total">
      <small>Total · calculated by the store server</small>
      <strong
        >${formatAtomic(
          total,
          catalog.network.asset.decimals,
          catalog.network.asset.symbol,
        )}</strong
      >
    </div>
    <button
      type="button"
      data-testid="checkout"
      ${attr('disabled', empty || stage === 'creating')}
      ${on('click', () => void checkout())}
    >
      ${stage === 'creating' ? 'Creating checkout…' : 'Checkout with Payrail'}
    </button>
  </section>`;
}

function paymentModal(
  order: StoreOrder,
  checkout: Checkout,
  stage: PaymentStage,
  close: () => void,
  reset: () => void,
) {
  const finalized = stage === 'finalized';
  return html`<div class="modal-backdrop" role="presentation">
    <section
      class="payment-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-title"
    >
      <button
        class="modal-close"
        type="button"
        aria-label="Close checkout"
        ${on('click', close)}
      >
        ×
      </button>
      <div class="payment-copy">
        <p class="eyebrow">
          ${finalized ? 'Payment complete' : 'Payrail Code · DEVNET'}
        </p>
        <h2 id="payment-title">
          ${finalized ? 'Receipt finalized.' : 'Scan. Review. Pay.'}
        </h2>
        <p>
          ${finalized
            ? 'The network independently finalized this order. The receipt below is immutable.'
            : 'Open the Payrail wallet on another device, or continue in this browser. Always review the recipient and amount before signing.'}
        </p>
        <dl>
          <div>
            <dt>Amount</dt>
            <dd>
              ${formatAtomic(
                order.totalAtomic,
                checkout.asset.decimals,
                checkout.asset.symbol,
              )}
            </dd>
          </div>
          <div>
            <dt>Recipient</dt>
            <dd>${short(checkout.merchantAddress)}</dd>
          </div>
          <div>
            <dt>Order</dt>
            <dd>${short(checkout.id)}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd><span class="status-dot"></span>${checkout.status}</dd>
          </div>
          ${checkout.transaction
            ? html`<div>
                <dt>Transaction</dt>
                <dd>${short(checkout.transaction.id)}</dd>
              </div>`
            : null}
        </dl>
        ${finalized
          ? html`<button
              class="primary-action"
              data-testid="order-finalized"
              type="button"
              ${on('click', reset)}
            >
              Continue shopping
            </button>`
          : html`<a
              class="primary-action"
              data-testid="open-wallet"
              ${attr('href', order.paymentUrl)}
              target="_blank"
              rel="noopener"
              >Open secure wallet ↗</a
            >`}
        <small class="integrity"
          >Verified with
          <a href="https://github.com/payrail-one/sdk">@payrail-one/sdk</a>. No
          wallet secret enters this store.</small
        >
      </div>
      <div class="scan-panel">
        ${finalized ? successMark() : payrailScan(order.paymentUrl)}
        <strong>${finalized ? 'FINALIZED' : 'PAYRAIL CODE'}</strong>
        <small
          >${finalized
            ? `Block #${checkout.transaction?.blockHeight ?? '—'}`
            : 'Tap to pay · camera QR available'}</small
        >
      </div>
    </section>
  </div>`;
}

function successMark() {
  return html`<div class="success-mark" aria-label="Payment finalized">
    <span>✓</span>
  </div>`;
}

function loadingCards() {
  return html`${repeat(
    [1, 2, 3, 4],
    (value) => value,
    () => html`<div class="product-card loading"></div>`,
  )}`;
}

function itemCount(quantities: ReadonlyMap<string, number>): number {
  let count = 0;
  for (const quantity of quantities.values()) count += quantity;
  return count;
}

function short(value: string): string {
  return value.length < 22 ? value : `${value.slice(0, 10)}…${value.slice(-8)}`;
}

function productIndex(id: string): number {
  const order = ['orbit-lamp', 'field-notebook', 'arc-speaker', 'mineral-cup'];
  const index = order.indexOf(id);
  return index < 0 ? 0 : index;
}

function scrollCart(): void {
  document.querySelector('#bag')?.scrollIntoView({ behavior: 'smooth' });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}
