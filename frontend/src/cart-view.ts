import { attr, html, on, repeat } from 'workstar';
import type { Catalog, Product } from './api';
import { formatAtomic, sumCartAtomic } from './money';
import { productImage } from './product-assets';

export function cartDrawer(
  catalog: Catalog,
  quantities: ReadonlyMap<string, number>,
  busy: boolean,
  actions: {
    readonly close: () => void;
    readonly change: (id: string, delta: number) => void;
    readonly checkout: () => Promise<void>;
  },
) {
  const lines = catalog.products.filter(
    (product) => (quantities.get(product.id) ?? 0) > 0,
  );
  const prices = new Map(
    catalog.products.map((product) => [product.id, product.priceAtomic]),
  );
  const total = sumCartAtomic(prices, quantities);
  return html`<div class="drawer-layer" role="presentation">
    <button
      class="drawer-scrim"
      type="button"
      aria-label="Close bag"
      ${on('click', actions.close)}
    ></button>
    <aside
      class="cart-drawer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bag-title"
    >
      <header>
        <div>
          <p class="kicker">Your selection</p>
          <h2 id="bag-title">Bag</h2>
        </div>
        <button
          type="button"
          aria-label="Close bag"
          ${on('click', actions.close)}
        >
          Close
        </button>
      </header>
      ${lines.length > 0
        ? html`<div class="cart-lines">
              ${repeat(
                lines,
                (product) => product.id,
                (product) =>
                  cartLine(
                    product.value,
                    quantities.get(product.value.id) ?? 0,
                    catalog,
                    actions.change,
                  ),
              )}
            </div>
            <div class="cart-summary">
              <div>
                <span>Subtotal</span
                ><strong
                  >${formatAtomic(
                    total,
                    catalog.network.asset.decimals,
                    catalog.network.asset.symbol,
                  )}</strong
                >
              </div>
              <p>Delivery and duties are included in this demonstration.</p>
              <button
                type="button"
                data-testid="checkout"
                ${attr('disabled', busy)}
                ${on('click', () => void actions.checkout())}
              >
                ${busy ? 'Creating secure checkout…' : 'Checkout with Payrail'}
              </button>
              <small
                ><span>●</span> Payrail devnet is online · independently
                finalized</small
              >
            </div>`
        : emptyBag(actions.close)}
    </aside>
  </div>`;
}

export function productQuickView(
  product: Product,
  catalog: Catalog,
  close: () => void,
  add: (product: Product) => void,
) {
  return html`<div class="drawer-layer product-layer" role="presentation">
    <button
      class="drawer-scrim"
      type="button"
      aria-label="Close product"
      ${on('click', close)}
    ></button>
    <section
      class="product-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-title"
    >
      <button
        class="dialog-close"
        type="button"
        aria-label="Close product"
        ${on('click', close)}
      >
        Close
      </button>
      <div class="dialog-image">
        <img
          ${attr('src', productImage(product.id))}
          ${attr('alt', product.name)}
        />
      </div>
      <div class="dialog-copy">
        <p class="kicker">${product.category} · ${product.edition}</p>
        <h2 id="product-title">${product.name}</h2>
        <strong
          >${formatAtomic(
            product.priceAtomic,
            catalog.network.asset.decimals,
            catalog.network.asset.symbol,
          )}</strong
        >
        <p>
          ${product.description} Selected for tactile materials, quiet
          proportions, and daily use.
        </p>
        <button
          type="button"
          ${attr('data-testid', `quick-add-${product.id}`)}
          ${on('click', () => add(product))}
        >
          Add to bag
        </button>
        <dl>
          <div>
            <dt>Edition</dt>
            <dd>Small batch</dd>
          </div>
          <div>
            <dt>Delivery</dt>
            <dd>Complimentary</dd>
          </div>
          <div>
            <dt>Returns</dt>
            <dd>Within 30 days</dd>
          </div>
        </dl>
      </div>
    </section>
  </div>`;
}

function cartLine(
  product: Product,
  quantity: number,
  catalog: Catalog,
  change: (id: string, delta: number) => void,
) {
  return html`<article class="cart-line">
    <img
      ${attr('src', productImage(product.id))}
      ${attr('alt', product.name)}
    />
    <div class="cart-line-copy">
      <small>${product.category}</small>
      <h3>${product.name}</h3>
      <strong
        >${formatAtomic(
          product.priceAtomic,
          catalog.network.asset.decimals,
          catalog.network.asset.symbol,
        )}</strong
      >
      <div class="line-quantity">
        <button
          type="button"
          aria-label="Remove one"
          ${on('click', () => change(product.id, -1))}
        >
          −
        </button>
        <span>${quantity}</span>
        <button
          type="button"
          aria-label="Add one"
          ${attr('disabled', quantity >= 5)}
          ${on('click', () => change(product.id, 1))}
        >
          +
        </button>
      </div>
    </div>
  </article>`;
}

function emptyBag(close: () => void) {
  return html`<div class="empty-bag">
    <span>0</span>
    <h3>Your bag is empty.</h3>
    <p>Explore the new collection and choose an object to keep.</p>
    <button type="button" ${on('click', close)}>Continue shopping</button>
  </div>`;
}
