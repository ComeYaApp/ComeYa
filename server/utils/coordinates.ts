/**
 * Validación de coordenadas GPS compartida por todos los puntos de entrada
 * (direcciones, negocios, pedidos, proxy de rutas).
 *
 * Una coordenada inválida (0,0, NaN, fuera de rango) rompe la ruta por
 * calles del pedido: Google devuelve ZERO_RESULTS y OSRM NoSegment, y el
 * mapa se queda sin línea. Todos los guardas usan esta única función.
 */
export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  const la = Number(lat);
  const ln = Number(lng);
  return (
    Number.isFinite(la) &&
    Number.isFinite(ln) &&
    la !== 0 &&
    ln !== 0 &&
    Math.abs(la) <= 90 &&
    Math.abs(ln) <= 180
  );
}
