import { elementRef, html } from 'workstar';
import { encode } from 'uqr';

export function payrailScan(value: string) {
  const qr = encode(value, { ecc: 'H', border: 4 });
  const size = 720;
  return html`<div class="scan-mark" data-testid="payment-qr">
    <svg class="scan-halo" viewBox="0 0 360 360" aria-hidden="true">
      <circle class="halo-track" cx="180" cy="180" r="160"></circle>
      <circle class="halo-one" cx="180" cy="180" r="160"></circle>
      <circle class="halo-two" cx="180" cy="180" r="146"></circle>
      <circle class="halo-three" cx="180" cy="180" r="132"></circle>
    </svg>
    <div class="scan-qr">
      <canvas
        width="720"
        height="720"
        role="img"
        aria-label="QR code for this Payrail checkout"
        ${elementRef((element) => {
          if (element) paintQr(element, qr.data, qr.size, size);
        })}
      ></canvas>
      <span class="scan-center" aria-hidden="true">P</span>
    </div>
  </div>`;
}

function paintQr(
  element: Element,
  data: readonly (readonly boolean[])[],
  modules: number,
  canvasSize: number,
): void {
  if (!(element instanceof HTMLCanvasElement)) return;
  const context = element.getContext('2d');
  if (!context) return;
  const pixel = canvasSize / modules;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvasSize, canvasSize);
  context.fillStyle = '#07110d';
  data.forEach((row, y) => {
    row.forEach((filled, x) => {
      if (!filled) return;
      context.fillRect(
        Math.floor(x * pixel),
        Math.floor(y * pixel),
        Math.ceil(pixel),
        Math.ceil(pixel),
      );
    });
  });
}
