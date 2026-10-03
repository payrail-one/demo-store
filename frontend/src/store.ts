import { PayrailCheckout, type Checkout } from '@payrail-one/sdk';
import { html, signal } from 'workstar';
import { type Catalog, type Product, StoreApi, type StoreOrder } from './api';
import { cartDrawer, productQuickView } from './cart-view';
import { storefront } from './catalog-view';
import { paymentModal, type PaymentStage } from './payment-view';

export function createStore() {
  const api = new StoreApi();
  const catalog = signal<Catalog | null>(null);
  const quantities = signal(new Map<string, number>());
  const activeCategory = signal('All');
  const selectedProduct = signal<Product | null>(null);
  const cartOpen = signal(false);
  const order = signal<StoreOrder | null>(null);
  const checkout = signal<Checkout | null>(null);
  const stage = signal<PaymentStage>('cart');
  const codeStage = signal<'idle' | 'claiming' | 'claimed' | 'failed'>('idle');
  const codeMessage = signal('');
  const message = signal('Connecting to the Payrail network…');
  let polling: AbortController | null = null;

  const load = async () => {
    try {
      catalog.value = await api.catalog();
      message.value = `Payrail online · block #${catalog.value.network.finalizedHeight}`;
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

  const addProduct = (product: Product) => {
    changeQuantity(product.id, 1);
    selectedProduct.value = null;
    cartOpen.value = true;
  };

  const startCheckout = async () => {
    const current = catalog.value;
    if (!current || quantities.value.size === 0) return;
    stage.value = 'creating';
    message.value = 'Creating an immutable Payrail checkout…';
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
      cartOpen.value = false;
      stage.value = 'awaiting';
      message.value = 'Checkout verified · waiting for payment';
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
          message.value = 'Payment independently finalized';
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
    codeStage.value = 'idle';
    codeMessage.value = '';
    restoreNetworkMessage(catalog.value, message);
  };

  const resetOrder = () => {
    closeCheckout();
    quantities.value = new Map();
  };

  const claimApprovalCode = async (event: Event) => {
    event.preventDefault();
    if (!order.value || codeStage.value === 'claiming') return;
    const code = new FormData(event.currentTarget as HTMLFormElement).get(
      'approval-code',
    );
    codeStage.value = 'claiming';
    codeMessage.value = 'Linking securely…';
    try {
      if (typeof code !== 'string') throw new Error('Enter a Payrail Code.');
      await api.claimApprovalCode(order.value.checkout.id, code);
      codeStage.value = 'claimed';
      codeMessage.value = 'Linked. Confirm the exact payment in your wallet.';
    } catch (error) {
      codeStage.value = 'failed';
      codeMessage.value = errorMessage(error);
    }
  };

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (order.value) closeCheckout();
    else if (selectedProduct.value) selectedProduct.value = null;
    else cartOpen.value = false;
  });

  void load();

  return html`<div class="site-shell">
    ${() =>
      storefront(
        catalog.value,
        countItems(quantities.value),
        activeCategory.value,
        message.value,
        {
          openCart: () => (cartOpen.value = true),
          chooseCategory: (category) => (activeCategory.value = category),
          openProduct: (product) => (selectedProduct.value = product),
          addProduct,
        },
      )}
    ${() =>
      cartOpen.value && catalog.value
        ? cartDrawer(
            catalog.value,
            quantities.value,
            stage.value === 'creating',
            {
              close: () => (cartOpen.value = false),
              change: changeQuantity,
              checkout: startCheckout,
            },
          )
        : null}
    ${() =>
      selectedProduct.value && catalog.value
        ? productQuickView(
            selectedProduct.value,
            catalog.value,
            () => (selectedProduct.value = null),
            addProduct,
          )
        : null}
    ${() =>
      order.value && checkout.value
        ? paymentModal(
            order.value,
            checkout.value,
            stage.value,
            codeStage.value,
            codeMessage.value,
            claimApprovalCode,
            closeCheckout,
            resetOrder,
          )
        : null}
  </div>`;
}

function countItems(quantities: ReadonlyMap<string, number>): number {
  let total = 0;
  for (const quantity of quantities.values()) total += quantity;
  return total;
}

function restoreNetworkMessage(
  catalog: Catalog | null,
  message: { value: string },
): void {
  message.value = catalog
    ? `Payrail online · block #${catalog.network.finalizedHeight}`
    : 'Connecting to the Payrail network…';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}
