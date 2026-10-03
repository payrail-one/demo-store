import { elementRef, html } from 'workstar';
import { encode } from 'uqr';

export function payrailScan(value: string) {
  const qr = encode(value, { ecc: 'H', border: 4 });
  return html`<div class="payment-code" data-testid="payment-qr">
    <div class="radial-code">
      <canvas
        width="720"
        height="720"
        role="img"
        aria-label="Circular Payrail payment code"
        ${elementRef((element) => {
          if (element) paintRadialCode(element, value);
        })}
      ></canvas>
      <span class="radial-code-label" aria-hidden="true">PAYRAIL</span>
    </div>
    <details class="qr-fallback">
      <summary>Scan with a standard camera</summary>
      <div class="standard-qr">
        <canvas
          width="640"
          height="640"
          role="img"
          aria-label="Standard QR code for this Payrail checkout"
          ${elementRef((element) => {
            if (element) paintQr(element, qr.data, qr.size, 640);
          })}
        ></canvas>
      </div>
    </details>
  </div>`;
}

function paintRadialCode(element: Element, value: string): void {
  if (!(element instanceof HTMLCanvasElement)) return;
  const context = element.getContext('2d');
  if (!context) return;
  const bits = encodedBits(value);
  const center = 360;
  const rings = [302, 262, 222, 182, 142, 105];
  const slots = [34, 31, 28, 25, 22, 18];
  context.clearRect(0, 0, 720, 720);
  context.lineCap = 'round';

  let bitIndex = 0;
  rings.forEach((radius, ring) => {
    const count = slots[ring];
    const slot = (Math.PI * 2) / count;
    for (let segment = 0; segment < count; segment++) {
      const bit = bits[bitIndex++ % bits.length];
      const nextBit = bits[bitIndex++ % bits.length];
      if ((segment + ring * 2) % 9 === 0) continue;
      const start = -Math.PI / 2 + segment * slot + slot * 0.16;
      const length = slot * (nextBit ? 0.64 : 0.47);
      context.beginPath();
      context.arc(center, center, radius, start, start + length);
      context.lineWidth = ring < 2 ? 18 : 16;
      context.strokeStyle = bit ? '#f7fff9' : '#718b7b';
      context.stroke();
    }
  });

  context.beginPath();
  context.arc(center, center, 73, 0, Math.PI * 2);
  context.fillStyle = '#f7fff9';
  context.fill();
  context.beginPath();
  context.arc(center, center, 31, 0, Math.PI * 2);
  context.strokeStyle = '#07110d';
  context.lineWidth = 13;
  context.stroke();
  context.beginPath();
  context.moveTo(center + 20, center - 23);
  context.lineTo(center + 43, center - 23);
  context.lineTo(center + 43, center + 16);
  context.strokeStyle = '#07110d';
  context.lineWidth = 13;
  context.stroke();
}

function encodedBits(value: string): readonly number[] {
  const bytes = new TextEncoder().encode(value);
  let checksum = 2_166_136_261;
  for (const byte of bytes) {
    checksum ^= byte;
    checksum = Math.imul(checksum, 16_777_619) >>> 0;
  }
  const encoded = [...bytes];
  for (let shift = 24; shift >= 0; shift -= 8) {
    encoded.push((checksum >>> shift) & 0xff);
  }
  return encoded.flatMap((byte) =>
    Array.from({ length: 8 }, (_, bit) => (byte >>> (7 - bit)) & 1),
  );
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
