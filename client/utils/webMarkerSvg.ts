/**
 * Librería de iconos SVG para marcadores de Google Maps (web).
 *
 * Sustituye a los emojis incrustados en SVG data-URI (🏪🛵🏠), que los
 * navegadores rasterizan como cajas blancas al no cargar la fuente emoji
 * dentro de data URIs. Aquí todos los iconos son paths vectoriales propios.
 *
 * Las claves de icono coinciden con las de utils/markerMeta.ts.
 */

export interface WebMarkerIcon {
  url: string;
  w: number;
  h: number;
  ax: number; // anchor x
  ay: number; // anchor y
}

/** Convierte un WebMarkerIcon en el objeto icon de google.maps.Marker */
export function asGoogleIcon(g: any, m: WebMarkerIcon) {
  return {
    url: m.url,
    scaledSize: new g.maps.Size(m.w, m.h),
    anchor: new g.maps.Point(m.ax, m.ay),
  };
}

type IconDef = { s?: string; f?: string };

/** Iconos en espacio 24x24. s = trazos (stroke), f = relleno (fill). */
const ICONS: Record<string, IconDef> = {
  home: {
    s: `<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>`,
  },
  storefront: {
    f: `<path d="M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z"/>`,
  },
  cart: {
    s: `<path d="M1 2h3l2.6 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6.2"/>`,
    f: `<circle cx="9" cy="21" r="1.6"/><circle cx="20" cy="21" r="1.6"/>`,
  },
  coffee: {
    s: `<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><path d="M6 1v3M10 1v3M14 1v3"/>`,
  },
  pizza: {
    s: `<path d="M12 2C8.4 2 5.2 3.5 3 6.1v.1L12 22l9-15.8C18.8 3.5 15.6 2 12 2z"/>`,
    f: `<circle cx="10.5" cy="8.5" r="1.2"/><circle cx="14.8" cy="10.5" r="1"/><circle cx="12" cy="14" r="1"/>`,
  },
  hamburger: {
    s: `<path d="M4 10c0-3.3 3.6-6 8-6s8 2.7 8 6v.5H4V10z"/><path d="M4 13.5h16"/><path d="M5.5 16.5h13a3.5 3.5 0 0 1-3.5 3H9a3.5 3.5 0 0 1-3.5-3z"/>`,
  },
  noodles: {
    s: `<path d="M3 11h18c0 5-3.6 8.5-9 8.5S3 16 3 11z"/><path d="M18.5 3 9.8 10.5"/><path d="M21.5 6l-8.2 6"/>`,
  },
  fish: {
    s: `<path d="M2.5 12c2.8-4 6.2-6 9.5-6 4 0 7.5 2.5 9.5 6-2 3.5-5.5 6-9.5 6-3.3 0-6.7-2-9.5-6z"/><path d="M4.8 9.5 1.5 7l.8 5-.8 5 3.3-2.5"/>`,
    f: `<circle cx="16.5" cy="10.8" r="1"/>`,
  },
  food: {
    s: `<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>`,
  },
  "ice-cream": {
    s: `<path d="M12 3a5 5 0 0 1 5 5c0 1.5-.8 2.8-2 3.5L12 21 9 11.5C7.8 10.8 7 9.5 7 8a5 5 0 0 1 5-5z"/>`,
  },
  "bread-slice": {
    s: `<path d="M8 3h8a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4z"/>`,
  },
  "medical-bag": {
    f: `<path d="M9 3h6v3h2.5C18.9 6 20 7.1 20 8.5V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8.5C4 7.1 5.1 6 6.5 6H9V3zm2 2v1h2V5h-2zm-1 5v2H8v2h2v2h2v-2h2v-2h-2v-2h-2z"/>`,
  },
  "silverware-fork-knife": {
    s: `<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>`,
  },
  "package-variant-closed": {
    s: `<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/>`,
  },
  navigation: {
    f: `<path d="M3 11l19-9-9 19-2-8-8-2z"/>`,
  },
  bike: {
    s: `<circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>`,
    f: `<circle cx="15" cy="5" r="1.3"/>`,
  },
  moped: {
    s: `<circle cx="5.5" cy="17" r="3"/><circle cx="18.5" cy="17" r="3"/><path d="M5.5 17h4l2.5-6h3.5"/><path d="M15 11l3.5 6"/><path d="M12 8.5h3.5l1.5 3"/><path d="M8 9.5h3.5"/>`,
  },
  motorbike: {
    s: `<circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M8 17h4.5l2-4.5h2.5"/><path d="M14 12.5 16.5 17"/><path d="M9 9.5h4.5l.5 1.5"/><path d="M16.5 8.5l2.5 4"/>`,
  },
  car: {
    s: `<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>`,
  },
  truck: {
    f: `<rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/>`,
    s: `<circle cx="5.5" cy="19" r="2.5"/><circle cx="18.5" cy="19" r="2.5"/>`,
  },
};

/** markerMeta usa nombres MaterialCommunityIcons; aquí van los equivalentes web */
const KEY_MAP: Record<string, string> = {
  "silverware-fork-knife": "food",
  "package-variant-closed": "package-variant-closed",
  "bread-slice": "bread-slice",
};

function iconMarkup(key: string, color: string, x: number, y: number, size: number): string {
  const def = ICONS[KEY_MAP[key] ?? key] ?? ICONS.storefront;
  const t = `transform="translate(${x} ${y}) scale(${size / 24})"`;
  let out = "";
  if (def.s) {
    out += `<g ${t} fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${def.s}</g>`;
  }
  if (def.f) {
    out += `<g ${t} fill="${color}">${def.f}</g>`;
  }
  return out;
}

const dataUri = (svg: string) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const PIN_PATH =
  "M20 0C8.95 0 0 8.95 0 20c0 14 20 30 20 30s20-16 20-30C40 8.95 31.05 0 20 0z";

/** Chincheta clásica con icono blanco, 48x60. */
export function pinIcon(color: string, iconKey: string): WebMarkerIcon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="60" viewBox="0 0 48 60">
  <g transform="scale(1.2)"><path d="${PIN_PATH}" fill="${color}" stroke="#FFFFFF" stroke-width="2"/></g>
  ${iconMarkup(iconKey, "#FFFFFF", 12, 12, 24)}
</svg>`;
  return { url: dataUri(svg), w: 48, h: 60, ax: 24, ay: 58 };
}

/** Chincheta con número (paradas de ruta). */
export function numberPin(label: string | number, color: string): WebMarkerIcon {
  const text = String(label);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="60" viewBox="0 0 48 60">
  <g transform="scale(1.2)"><path d="${PIN_PATH}" fill="${color}" stroke="#FFFFFF" stroke-width="2"/></g>
  <text x="24" y="31" text-anchor="middle" fill="#FFFFFF" font-family="Arial, sans-serif" font-weight="bold" font-size="${text.length > 1 ? 16 : 19}">${escapeXml(text)}</text>
</svg>`;
  return { url: dataUri(svg), w: 48, h: 60, ax: 24, ay: 58 };
}

/** Círculo de color con icono blanco centrado (repartidor en movimiento). */
export function circleIcon(color: string, iconKey: string, size = 46): WebMarkerIcon {
  const r = size / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <circle cx="${r}" cy="${r}" r="${r - 2}" fill="${color}" stroke="#FFFFFF" stroke-width="3"/>
  ${iconMarkup(iconKey, "#FFFFFF", size / 2 - 12, size / 2 - 12, 24)}
</svg>`;
  return { url: dataUri(svg), w: size, h: size, ax: r, ay: r };
}

/** Repartidor estilo Uber: círculo verde con vehículo + badge del vehículo. */
export function driverIcon(vehicleKey: string, color = "#10B981"): WebMarkerIcon {
  const size = 56;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <circle cx="27" cy="27" r="22" fill="${color}" stroke="#FFFFFF" stroke-width="3"/>
  ${iconMarkup(vehicleKey, "#FFFFFF", 15, 15, 24)}
  <circle cx="44" cy="44" r="11" fill="#FFFFFF" stroke="${color}" stroke-width="2"/>
  ${iconMarkup(vehicleKey, color, 38, 38, 12)}
</svg>`;
  return { url: dataUri(svg), w: size, h: size, ax: 27, ay: 27 };
}

/** Burbuja de negocio estilo Uber Eats: tarjeta blanca, icono del tipo + nombre. */
export function businessLabelIcon(opts: {
  iconKey: string;
  color: string;
  title: string;
  subtitle?: string;
}): WebMarkerIcon {
  const title = opts.title.length > 18 ? opts.title.slice(0, 17) + "…" : opts.title;
  const subtitle = opts.subtitle
    ? opts.subtitle.length > 22
      ? opts.subtitle.slice(0, 21) + "…"
      : opts.subtitle
    : null;
  const textW = Math.max(title.length * 6.4, (subtitle?.length ?? 0) * 5.1);
  const w = Math.min(Math.max(66 + textW, 96), 168);
  const h = subtitle ? 52 : 44;
  const cy = h / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w + 8}" height="${h + 12}" viewBox="0 0 ${w + 8} ${h + 12}">
  <rect x="4" y="2" width="${w}" height="${h - 6}" rx="${(h - 6) / 2}" fill="#FFFFFF" stroke="#E5E7EB" stroke-width="1"/>
  <rect x="4" y="2" width="${w}" height="${h - 6}" rx="${(h - 6) / 2}" fill="none" stroke="${opts.color}" stroke-width="1.5" stroke-opacity="0.35"/>
  <circle cx="${4 + 6 + 14}" cy="${cy}" r="14" fill="${opts.color}"/>
  ${iconMarkup(opts.iconKey, "#FFFFFF", 4 + 6 + 14 - 8, cy - 8, 16)}
  <text x="${4 + 6 + 28 + 7}" y="${cy - (subtitle ? 3 : -4)}" fill="#1F2937" font-family="Arial, sans-serif" font-weight="bold" font-size="11">${escapeXml(title)}</text>
  ${subtitle ? `<text x="${4 + 6 + 28 + 7}" y="${cy + 10}" fill="#6B7280" font-family="Arial, sans-serif" font-size="9">${escapeXml(subtitle)}</text>` : ""}
  <polygon points="${w / 2 - 6},${h - 4} ${w / 2 + 6},${h - 4} ${w / 2},${h + 7}" fill="#FFFFFF"/>
  <line x1="${w / 2 - 6}" y1="${h - 4}" x2="${w / 2}" y2="${h + 7}" stroke="#E5E7EB" stroke-width="1"/>
  <line x1="${w / 2 + 6}" y1="${h - 4}" x2="${w / 2}" y2="${h + 7}" stroke="#E5E7EB" stroke-width="1"/>
</svg>`;
  return { url: dataUri(svg), w: w + 8, h: h + 12, ax: (w + 8) / 2, ay: h + 7 };
}
