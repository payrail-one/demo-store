const assets: Readonly<Record<string, string>> = {
  'orbit-lamp': '/images/orbit-lamp.webp',
  'field-notebook': '/images/field-notebook.webp',
  'arc-speaker': '/images/arc-speaker.webp',
  'mineral-cup': '/images/mineral-cup.webp',
  'pebble-vase': '/images/pebble-vase.webp',
  'linen-throw': '/images/linen-throw.webp',
  'stone-tray': '/images/stone-tray.webp',
  'cedar-incense': '/images/cedar-incense.webp',
};

export function productImage(id: string): string {
  return assets[id] ?? '/images/aurora-hero.webp';
}
