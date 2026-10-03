export function formatAtomic(
  atomic: string,
  decimals: number,
  symbol: string,
): string {
  if (!/^(0|[1-9][0-9]*)$/.test(atomic)) {
    throw new Error('Invalid canonical atomic amount.');
  }
  if (!Number.isSafeInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error('Unsupported asset precision.');
  }
  const padded = atomic.padStart(decimals + 1, '0');
  const whole = decimals === 0 ? padded : padded.slice(0, -decimals);
  const fraction = decimals === 0 ? '' : padded.slice(-decimals);
  const trimmed = fraction.replace(/0+$/, '');
  return `${whole}${trimmed ? `.${trimmed}` : ''} ${symbol}`;
}

export function sumCartAtomic(
  prices: ReadonlyMap<string, string>,
  quantities: ReadonlyMap<string, number>,
): string {
  let total = 0n;
  for (const [id, quantity] of quantities) {
    if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 5) {
      throw new Error('Invalid cart quantity.');
    }
    const price = prices.get(id);
    if (!price || !/^[1-9][0-9]*$/.test(price)) {
      throw new Error('Missing canonical catalog price.');
    }
    total += BigInt(price) * BigInt(quantity);
  }
  return total.toString();
}
