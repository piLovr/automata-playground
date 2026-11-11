// Export des sichtbaren Diagramms als eigenständige SVG- oder PNG-Datei.
// Die Stile werden aus dem gerenderten Bild übernommen (wahlweise im hellen Farbschema),
// damit die Datei ohne die App gleich aussieht.

const STYLE_PROPS = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-linejoin',
  'stroke-linecap',
  'opacity',
  'paint-order',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'text-anchor',
  'dominant-baseline',
] as const;

/** Bei Bedarf kurz auf das helle Farbschema umschalten, um dessen Farben auszulesen. */
function withTheme<T>(theme: 'light' | 'current', fn: () => T): T {
  if (theme === 'current') return fn();
  const root = document.documentElement;
  const before = root.getAttribute('data-theme');
  // Ohne das liefert getComputedStyle bei Elementen mit CSS-Übergang noch die alten Farben.
  const freeze = document.createElement('style');
  freeze.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
  document.head.append(freeze);
  root.setAttribute('data-theme', 'light');
  void root.offsetWidth;
  try {
    return fn();
  } finally {
    if (before === null) root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', before);
    void root.offsetWidth;
    freeze.remove();
  }
}

/**
 * Baut aus dem SVG des Graph-Editors bzw. der Graph-Ansicht eine eigenständige Datei.
 * content: die Gruppe mit dem Diagramm (ihre Transformation für Zoom/Verschieben fällt weg).
 */
export function standaloneSvg(content: SVGGElement, opts: { theme: 'light' | 'current'; pad?: number }): string {
  return withTheme(opts.theme, () => {
    const pad = opts.pad ?? 16;
    const box = content.getBBox();
    const clone = content.cloneNode(true) as SVGGElement;
    clone.removeAttribute('transform');

    // Stile Element für Element übertragen (Original und Klon haben dieselbe Struktur).
    const src = [content, ...content.querySelectorAll('*')] as Element[];
    const dst = [clone, ...clone.querySelectorAll('*')] as Element[];
    src.forEach((el, i) => {
      const target = dst[i] as SVGElement;
      const cs = getComputedStyle(el);
      const style = STYLE_PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(';');
      target.setAttribute('style', style);
      target.removeAttribute('class');
    });
    // Bedienelemente gehören nicht ins Bild.
    clone.querySelectorAll('[data-noexport]').forEach((n) => n.remove());

    const bg = getComputedStyle(document.documentElement).getPropertyValue('--sheet').trim() || '#ffffff';
    const w = box.width + 2 * pad;
    const h = box.height + 2 * pad;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('xmlns', ns);
    svg.setAttribute('viewBox', `${box.x - pad} ${box.y - pad} ${w} ${h}`);
    svg.setAttribute('width', String(Math.ceil(w)));
    svg.setAttribute('height', String(Math.ceil(h)));
    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('x', String(box.x - pad));
    rect.setAttribute('y', String(box.y - pad));
    rect.setAttribute('width', String(w));
    rect.setAttribute('height', String(h));
    rect.setAttribute('fill', bg);
    svg.append(rect, clone);
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(svg);
  });
}

/** Rastert eine SVG-Datei im Browser zu PNG. */
export async function svgToPng(svg: string, scale = 2): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(img.naturalWidth * scale);
    canvas.height = Math.ceil(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas nicht verfügbar');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    return await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG fehlgeschlagen'))), 'image/png'),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
