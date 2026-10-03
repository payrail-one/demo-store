import { attr, html, on, repeat } from 'workstar';
import type { Catalog, Product } from './api';
import { formatAtomic } from './money';
import { productImage } from './product-assets';

export function storefront(
  catalog: Catalog | null,
  itemCount: number,
  activeCategory: string,
  message: string,
  actions: {
    readonly openCart: () => void;
    readonly chooseCategory: (category: string) => void;
    readonly openProduct: (product: Product) => void;
    readonly addProduct: (product: Product) => void;
  },
) {
  const products = catalog?.products ?? [];
  const categories = [
    'All',
    ...new Set(products.map((product) => product.category)),
  ];
  const filtered =
    activeCategory === 'All'
      ? products
      : products.filter((product) => product.category === activeCategory);
  return html`<div class="storefront">
    ${announcement(message)} ${header(itemCount, actions.openCart)}
    <main>
      ${hero()}
      <section class="service-bar" aria-label="Store benefits">
        <span>Complimentary delivery</span><span>30-day returns</span
        ><span>Made in small editions</span><span>Payrail secured</span>
      </section>
      ${categoryEditorial()}
      <section class="shop-section" id="shop">
        <div class="shop-heading">
          <div>
            <p class="kicker">New collection · 01</p>
            <h2>Objects worth keeping.</h2>
          </div>
          <p>
            Functional pieces chosen for material honesty, useful proportions,
            and the calm they bring to a room.
          </p>
        </div>
        <div class="catalog-toolbar">
          <div
            class="category-tabs"
            role="tablist"
            aria-label="Product categories"
          >
            ${repeat(
              categories,
              (category) => category,
              (category) =>
                html`<button
                  type="button"
                  role="tab"
                  ${attr('aria-selected', () =>
                    category.value === activeCategory ? 'true' : 'false',
                  )}
                  ${on('click', () => actions.chooseCategory(category.value))}
                >
                  ${() => category.value}
                </button>`,
            )}
          </div>
          <span>${filtered.length} pieces</span>
        </div>
        <div class="product-grid" data-testid="catalog">
          ${catalog
            ? repeat(
                filtered,
                (product) => product.id,
                (product) =>
                  productCard(
                    product.value,
                    catalog,
                    actions.openProduct,
                    actions.addProduct,
                  ),
              )
            : loadingCards()}
        </div>
      </section>
      ${editorialStory()} ${newsletter()}
    </main>
    ${footer()}
  </div>`;
}

function announcement(message: string) {
  return html`<div class="announcement" role="status">
    <span>Payrail devnet boutique · no real funds</span><span>${message}</span>
  </div>`;
}

function header(itemCount: number, openCart: () => void) {
  return html`<header class="retail-header">
    <button class="mobile-menu" type="button" aria-label="Open menu">
      Menu
    </button>
    <a class="aurora-wordmark" href="#top" aria-label="Aurora Market home"
      >AURORA</a
    >
    <nav aria-label="Shop navigation">
      <a href="#shop">New arrivals</a><a href="#shop">Living</a
      ><a href="#shop">Table</a><a href="#journal">Journal</a>
    </nav>
    <div class="header-tools">
      <a href="https://merchant.payrail.one">For merchants</a>
      <button type="button" data-testid="open-cart" ${on('click', openCart)}>
        Bag <span>${itemCount}</span>
      </button>
    </div>
  </header>`;
}

function hero() {
  return html`<section class="campaign" id="top">
    <img
      src="/images/aurora-hero.webp"
      alt="Orbit Lamp, ceramic cup and notebook in a warm modern interior"
      fetchpriority="high"
    />
    <div class="campaign-shade"></div>
    <div class="campaign-copy">
      <p class="kicker">Autumn collection · Aurora 01</p>
      <h1>Considered objects<br />for everyday rituals.</h1>
      <p>
        Lighting, sound, paper and tableware selected for quieter rooms and
        slower mornings.
      </p>
      <a class="dark-button" href="#shop">Shop the collection</a>
    </div>
    <span class="campaign-caption">Morning light · Nuanu, 08:12</span>
  </section>`;
}

function categoryEditorial() {
  return html`<section class="category-editorial" aria-label="Shop by category">
    <a href="#shop" class="category-story story-light">
      <img
        src="/images/orbit-lamp.webp"
        alt="Frosted glass Orbit Lamp"
        loading="lazy"
      />
      <span
        ><small>01</small><strong>Light for living</strong
        ><em>Explore lighting →</em></span
      >
    </a>
    <a href="#shop" class="category-story story-table">
      <img
        src="/images/mineral-cup.webp"
        alt="Handmade mineral ceramic cup"
        loading="lazy"
      />
      <span
        ><small>02</small><strong>The considered table</strong
        ><em>Explore tableware →</em></span
      >
    </a>
    <a href="#shop" class="category-story story-sound">
      <img
        src="/images/arc-speaker.webp"
        alt="Charcoal Arc Speaker"
        loading="lazy"
      />
      <span
        ><small>03</small><strong>Sound, softened</strong
        ><em>Explore sound →</em></span
      >
    </a>
  </section>`;
}

function productCard(
  product: Product,
  catalog: Catalog,
  openProduct: (product: Product) => void,
  addProduct: (product: Product) => void,
) {
  return html`<article class="retail-product">
    <button
      class="product-image"
      type="button"
      ${attr('aria-label', `View ${product.name}`)}
      ${on('click', () => openProduct(product))}
    >
      <img
        ${attr('src', productImage(product.id))}
        ${attr('alt', product.name)}
        loading="lazy"
      />
      <span class="product-badge">${product.edition}</span>
      <span class="quick-view">Quick view</span>
    </button>
    <div class="retail-product-info">
      <button type="button" ${on('click', () => openProduct(product))}>
        <span>${product.name}</span><small>${product.category}</small>
      </button>
      <div>
        <strong
          >${formatAtomic(
            product.priceAtomic,
            catalog.network.asset.decimals,
            catalog.network.asset.symbol,
          )}</strong
        >
        <button
          class="quick-add"
          type="button"
          ${attr('data-testid', `add-${product.id}`)}
          ${on('click', () => addProduct(product))}
        >
          Add
        </button>
      </div>
    </div>
  </article>`;
}

function editorialStory() {
  return html`<section class="editorial-story" id="journal">
    <div class="editorial-image">
      <img
        src="/images/linen-throw.webp"
        alt="Natural linen throw"
        loading="lazy"
      />
    </div>
    <div class="editorial-copy">
      <p class="kicker">Material study · 03</p>
      <h2>A home should feel collected, not completed.</h2>
      <p>
        We work with small studios and independent makers who understand that
        the most useful objects become more personal with time.
      </p>
      <a href="#shop">Read the material journal →</a>
      <dl>
        <div>
          <dt>Natural materials</dt>
          <dd>Stone · linen · ceramic</dd>
        </div>
        <div>
          <dt>Production</dt>
          <dd>Small-batch editions</dd>
        </div>
        <div>
          <dt>Packaging</dt>
          <dd>Plastic-free</dd>
        </div>
      </dl>
    </div>
  </section>`;
}

function newsletter() {
  return html`<section class="newsletter">
    <p class="kicker">Aurora letters</p>
    <h2>New objects, thoughtful spaces,<br />and occasional notes.</h2>
    <form ${on('submit', (event) => event.preventDefault())}>
      <label
        ><span>Email address</span
        ><input type="email" placeholder="you@example.com" required
      /></label>
      <button type="submit">Subscribe</button>
    </form>
  </section>`;
}

function footer() {
  return html`<footer class="retail-footer">
    <div>
      <a class="aurora-wordmark" href="#top">AURORA</a>
      <p>Objects for quieter rooms and everyday rituals.</p>
    </div>
    <div>
      <strong>Shop</strong><a href="#shop">New arrivals</a
      ><a href="#shop">Living</a><a href="#shop">Table</a>
    </div>
    <div>
      <strong>About</strong><a href="#journal">Our approach</a
      ><a href="#journal">Materials</a
      ><a href="https://github.com/payrail-one/demo-store">Source code ↗</a>
    </div>
    <div>
      <strong>Payrail</strong><a href="https://payrail.one">Ecosystem ↗</a
      ><a href="https://merchant.payrail.one">Merchant portal ↗</a
      ><a href="https://github.com/payrail-one/sdk">Checkout SDK ↗</a>
    </div>
    <small>Development demonstration · TEST units have no monetary value</small>
  </footer>`;
}

function loadingCards() {
  return html`${repeat(
    [1, 2, 3, 4],
    (value) => value,
    () => html`<div class="retail-product product-loading"></div>`,
  )}`;
}
