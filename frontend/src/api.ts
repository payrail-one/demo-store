import type { Checkout, NetworkStatus } from '@payrail-one/sdk';

export interface Product {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly description: string;
  readonly priceAtomic: string;
  readonly tone: string;
  readonly edition: string;
}

export interface Catalog {
  readonly merchantAddress: string;
  readonly products: readonly Product[];
  readonly network: NetworkStatus;
}

export interface CartItem {
  readonly productId: string;
  readonly quantity: number;
}

export interface OrderLine {
  readonly product: Product;
  readonly quantity: number;
  readonly totalAtomic: string;
}

export interface StoreOrder {
  readonly checkout: Checkout;
  readonly lines?: readonly OrderLine[];
  readonly totalAtomic: string;
  readonly paymentUrl: string;
}

export class StoreApi {
  async catalog(): Promise<Catalog> {
    return request<Catalog>('/store/catalog');
  }

  async createOrder(items: readonly CartItem[]): Promise<StoreOrder> {
    return request<StoreOrder>('/store/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items }),
    });
  }

  async order(id: string): Promise<StoreOrder> {
    return request<StoreOrder>(`/store/orders/${encodeURIComponent(id)}`);
  }
}

async function request<Value>(
  path: string,
  init?: RequestInit,
): Promise<Value> {
  const response = await fetch(path, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: unknown;
    } | null;
    throw new Error(
      typeof body?.error === 'string' ? body.error : 'Store request failed.',
    );
  }
  return (await response.json()) as Value;
}
