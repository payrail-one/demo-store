import type { Checkout } from '@payrail-one/sdk';
import { attr, html, on } from 'workstar';
import type { StoreOrder } from './api';
import { formatAtomic } from './money';
import { payrailScan } from './payrail-scan';

export type PaymentStage =
  | 'cart'
  | 'creating'
  | 'awaiting'
  | 'finalized'
  | 'failed';

export function paymentModal(
  order: StoreOrder,
  checkout: Checkout,
  stage: PaymentStage,
  codeStage: 'idle' | 'claiming' | 'claimed' | 'failed',
  codeMessage: string,
  claimApprovalCode: (event: Event) => Promise<void>,
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
        ${!finalized
          ? approvalCodeForm(codeStage, codeMessage, claimApprovalCode)
          : null}
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

function approvalCodeForm(
  stage: 'idle' | 'claiming' | 'claimed' | 'failed',
  message: string,
  submit: (event: Event) => Promise<void>,
) {
  return html`<form
    class="approval-code-form"
    data-testid="approval-code-form"
    ${on('submit', (event) => void submit(event))}
  >
    <div>
      <label for="approval-code">Pay with six-digit code</label>
      <small>Generate it inside your unlocked Payrail wallet.</small>
    </div>
    <div class="approval-code-entry">
      <input
        id="approval-code"
        name="approval-code"
        data-testid="approval-code-input"
        inputmode="numeric"
        autocomplete="one-time-code"
        pattern="[0-9]{6}"
        minlength="6"
        maxlength="6"
        placeholder="000000"
        required
        ${attr('disabled', stage === 'claiming' || stage === 'claimed')}
      />
      <button
        data-testid="submit-approval-code"
        type="submit"
        ${attr('disabled', stage === 'claiming' || stage === 'claimed')}
      >
        ${stage === 'claiming'
          ? 'Linking…'
          : stage === 'claimed'
            ? 'Linked ✓'
            : 'Continue'}
      </button>
    </div>
    ${message ? html`<p ${attr('data-state', stage)}>${message}</p>` : null}
  </form>`;
}

function successMark() {
  return html`<div class="success-mark" aria-label="Payment finalized">
    <span>✓</span>
  </div>`;
}

function short(value: string): string {
  return value.length < 22 ? value : `${value.slice(0, 10)}…${value.slice(-8)}`;
}
