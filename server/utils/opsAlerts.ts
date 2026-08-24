/**
 * Lógica de alertas operativas del centro de control del admin.
 * Módulo puro (sin BD ni express) para poder testearlo aislado.
 */

// Umbrales en minutos
export const ALERT_NO_DRIVER_MIN = 10; // listo/preparando sin repartidor
export const ALERT_NO_RESPONSE_MIN = 5; // el negocio no responde
export const ALERT_STALE_GPS_MIN = 5; // GPS del repartidor congelado
export const ALERT_TOTAL_MIN = 60; // pedido demasiado tiempo abierto

/** Un repartidor cuenta como conectado si su GPS es más reciente que esto. */
export const DRIVER_ONLINE_WINDOW_MIN = 10;

/** Estados activos según el enum real de la BD. */
export const ACTIVE_STATUSES = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "assigned_driver",
  "picked_up",
  "on_the_way",
  "in_transit",
  "arriving",
] as const;

/** Estados en los que el repartidor ya lleva el pedido encima. */
export const IN_TRANSIT_STATUSES = [
  "picked_up",
  "on_the_way",
  "in_transit",
  "arriving",
];

export interface OrderAlert {
  type: "no_driver" | "no_response" | "stale_gps" | "too_long";
  message: string;
}

export interface AlertInput {
  status: string;
  minutesActive: number | null;
  hasDriver: boolean;
  businessResponseAt?: any;
  driverLastUpdateMinutes?: number | null;
}

/** Minutos transcurridos desde una fecha (null si no es válida). */
export function minutesSince(value: any): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 60000));
}

export function computeOrderAlerts(order: AlertInput): OrderAlert[] {
  const alerts: OrderAlert[] = [];
  const mins = order.minutesActive ?? 0;

  if (
    !order.hasDriver &&
    ["preparing", "ready"].includes(order.status) &&
    mins >= ALERT_NO_DRIVER_MIN
  ) {
    alerts.push({
      type: "no_driver",
      message: `Sin repartidor hace ${mins} min`,
    });
  }

  if (
    order.status === "pending" &&
    !order.businessResponseAt &&
    mins >= ALERT_NO_RESPONSE_MIN
  ) {
    alerts.push({
      type: "no_response",
      message: `El negocio no responde (${mins} min)`,
    });
  }

  if (
    order.hasDriver &&
    IN_TRANSIT_STATUSES.includes(order.status) &&
    order.driverLastUpdateMinutes != null &&
    order.driverLastUpdateMinutes >= ALERT_STALE_GPS_MIN
  ) {
    alerts.push({
      type: "stale_gps",
      message: `GPS sin señal hace ${order.driverLastUpdateMinutes} min`,
    });
  }

  if (mins >= ALERT_TOTAL_MIN) {
    alerts.push({
      type: "too_long",
      message: `Pedido abierto hace ${mins} min`,
    });
  }

  return alerts;
}

/** Un repartidor está "conectado" si está disponible y su GPS es fresco. */
export function isDriverOnline(
  isAvailable: boolean,
  lastUpdateMinutes: number | null,
): boolean {
  return (
    !!isAvailable &&
    lastUpdateMinutes != null &&
    lastUpdateMinutes < DRIVER_ONLINE_WINDOW_MIN
  );
}
