/**
 * Fase de ruta de un pedido según su estado, para que TODOS los mapas
 * (cliente, negocio, repartidor, admin) dibujen el mismo destino:
 *
 *  - to_business: el repartidor aún no recogió el pedido → ruta hacia el LOCAL.
 *  - to_customer: pedido en mano → ruta hacia el cliente.
 *  - none: sin repartidor / entregado / cancelado → no hay ruta que dibujar.
 */
export type RoutePhase = "to_business" | "to_customer" | "none";

/** Estados en los que el destino del repartidor es el negocio (recogida). */
export const BUSINESS_PHASE_STATUSES = [
  "assigned_driver",
  "accepted",
  "confirmed",
  "preparing",
  "ready",
];

/** Estados en los que el repartidor ya lleva el pedido (entrega). */
export const CUSTOMER_PHASE_STATUSES = [
  "picked_up",
  "on_the_way",
  "in_transit",
  "arriving",
];

export function routePhaseForStatus(status?: string | null): RoutePhase {
  const s = String(status || "").toLowerCase();
  if (BUSINESS_PHASE_STATUSES.includes(s)) return "to_business";
  if (CUSTOMER_PHASE_STATUSES.includes(s)) return "to_customer";
  return "none";
}

/** ¿El pedido tiene repartidor y está en una fase con ruta? */
export function statusHasRoute(status?: string | null): boolean {
  return routePhaseForStatus(status) !== "none";
}
