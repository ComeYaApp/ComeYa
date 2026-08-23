// Clustering ligero por grid para mapas web (sin dependencias externas).
// Agrupa puntos cercanos según el nivel de zoom para no saturar el mapa.

export interface ClusterInput {
  id: string;
  lat: number;
  lng: number;
  data?: any;
}

export interface ClusterResult {
  lat: number;
  lng: number;
  count: number;
  items: ClusterInput[];
}

/** Tamaño de celda en grados según el zoom del mapa. */
function cellDegrees(zoom: number): number {
  // ~108 m a zoom 12, ~27 m a zoom 14, ~7 m a zoom 16
  return (1 / Math.pow(2, zoom)) * 4;
}

export function clusterPoints(
  points: ClusterInput[],
  zoom: number,
): ClusterResult[] {
  const cell = cellDegrees(zoom);
  const buckets = new Map<string, ClusterInput[]>();

  for (const p of points) {
    const cx = Math.floor(p.lng / cell);
    const cy = Math.floor(p.lat / cell);
    const key = `${cx}:${cy}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(p);
    else buckets.set(key, [p]);
  }

  const results: ClusterResult[] = [];
  for (const items of buckets.values()) {
    const lat = items.reduce((s, p) => s + p.lat, 0) / items.length;
    const lng = items.reduce((s, p) => s + p.lng, 0) / items.length;
    results.push({ lat, lng, count: items.length, items });
  }
  return results;
}

/** Icono SVG (data URI) para un cluster con contador. */
export function clusterSvg(count: number, color: string = "#DC2626"): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44">` +
    `<circle cx="22" cy="22" r="16" fill="${color}" opacity="0.92"/>` +
    `<circle cx="22" cy="22" r="9" fill="#ffffff" opacity="0.22"/>` +
    `<text x="22" y="27" font-size="13" font-weight="700" fill="#ffffff" ` +
    `text-anchor="middle" font-family="Arial, sans-serif">${count}</text></svg>`;
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}
