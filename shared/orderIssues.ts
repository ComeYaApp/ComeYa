// Catálogo de incidencias de pedido, compartido por la app y el servidor.
// Mantener sincronizado con order_issues.issue_type.

export const ISSUE_TYPES = [
  "missing_items",
  "wrong_items",
  "incomplete",
  "damaged",
  "quality",
  "late_delivery",
  "never_arrived",
  "driver_issue",
  "other",
] as const;

export type IssueType = (typeof ISSUE_TYPES)[number];

export const ISSUE_LABELS: Record<string, string> = {
  missing_items: "Artículos faltantes",
  wrong_items: "Artículos incorrectos",
  incomplete: "Pedido incompleto",
  damaged: "Producto dañado",
  quality: "Mala calidad",
  late_delivery: "Entrega tardía",
  never_arrived: "El pedido nunca llegó",
  driver_issue: "Problema con el repartidor",
  other: "Otro problema",
};

export const ISSUE_STATUS_LABELS: Record<string, string> = {
  open: "Abierta",
  in_review: "En revisión",
  resolved: "Resuelta",
  rejected: "Denegada",
};

export const RESOLUTION_LABELS: Record<string, string> = {
  refund_full: "Devolución total",
  refund_partial: "Devolución parcial",
  redelivery: "Reenvío del pedido",
  rejected: "Denegada",
};

export const LIABLE_PARTY_LABELS: Record<string, string> = {
  business: "Negocio",
  driver: "Repartidor",
  platform: "Plataforma",
};

export const REFUND_METHOD_LABELS: Record<string, string> = {
  stripe: "Devolución automática (Stripe)",
  manual_transfer: "Transferencia manual",
  cash_none: "Sin cargo previo",
};

export const REFUND_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  processing: "Procesando",
  completed: "Completada",
  failed: "Fallida",
};
