// Order Status Types - Estados simplificados de pedidos

export const ORDER_STATUS = {
  PENDING: "pending", // Esperando aceptación del negocio
  ACCEPTED: "accepted", // Negocio aceptó, buscando repartidor
  PREPARING: "preparing", // Negocio está preparando
  ON_THE_WAY: "on_the_way", // Repartidor recogió y va hacia cliente
  DELIVERED: "delivered", // Pedido completado
  CANCELLED: "cancelled", // Pedido cancelado
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

// Mapeo de estados antiguos a nuevos (para migración)
export const STATUS_MIGRATION_MAP: Record<string, OrderStatus> = {
  pending: ORDER_STATUS.PENDING,
  accepted: ORDER_STATUS.ACCEPTED,
  preparing: ORDER_STATUS.PREPARING,
  ready: ORDER_STATUS.ON_THE_WAY, // Listo -> En camino
  assigned: ORDER_STATUS.PREPARING, // Asignado -> Preparando
  picked_up: ORDER_STATUS.ON_THE_WAY, // Recogido -> En camino
  on_the_way: ORDER_STATUS.ON_THE_WAY,
  arriving: ORDER_STATUS.ON_THE_WAY, // Llegando -> En camino
  delivered: ORDER_STATUS.DELIVERED,
  cancelled: ORDER_STATUS.CANCELLED,
};

// Labels para UI
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [ORDER_STATUS.PENDING]: "Pendiente",
  [ORDER_STATUS.ACCEPTED]: "Aceptado",
  [ORDER_STATUS.PREPARING]: "Preparando",
  [ORDER_STATUS.ON_THE_WAY]: "En camino",
  [ORDER_STATUS.DELIVERED]: "Entregado",
  [ORDER_STATUS.CANCELLED]: "Cancelado",
};

// Colores para UI
export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  [ORDER_STATUS.PENDING]: "#FFA500", // Naranja
  [ORDER_STATUS.ACCEPTED]: "#4CAF50", // Verde
  [ORDER_STATUS.PREPARING]: "#2196F3", // Azul
  [ORDER_STATUS.ON_THE_WAY]: "#9C27B0", // Morado
  [ORDER_STATUS.DELIVERED]: "#4CAF50", // Verde
  [ORDER_STATUS.CANCELLED]: "#F44336", // Rojo
};

// Estados que permiten cancelación
export const CANCELLABLE_STATUSES: OrderStatus[] = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.ACCEPTED,
];

// Estados activos (no finalizados)
export const ACTIVE_STATUSES: OrderStatus[] = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.ACCEPTED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.ON_THE_WAY,
];

// Estados finales
export const FINAL_STATUSES: OrderStatus[] = [
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.CANCELLED,
];

// Función helper para normalizar estados antiguos
export function normalizeOrderStatus(status: string): OrderStatus {
  return STATUS_MIGRATION_MAP[status] || ORDER_STATUS.PENDING;
}
