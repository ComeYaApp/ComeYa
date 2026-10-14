// Metadatos compartidos de los avisos del admin (icono por tipo, niveles de
// severidad y tiempo relativo) usados por la campana, el Centro de Avisos
// y el feed "Actividad en tiempo real" del Centro de Operaciones.

export const LEVEL_META: Record<string, { label: string; color: string }> = {
  critical: { label: "Crítico", color: "#EF4444" },
  high: { label: "Importante", color: "#F59E0B" },
  medium: { label: "Info", color: "#3B82F6" },
};

export const TYPE_ICON: Record<string, string> = {
  new_order: "shopping-bag",
  new_registration: "user-plus",
  new_delivery_verification: "user-check",
  driver_data_updated: "truck",
  driver_document_updated: "file-text",
  document_updated: "file-text",
  new_proof: "file-text",
  new_fee_proof: "calendar",
  new_payout: "send",
  new_ticket: "message-circle",
  new_issue: "alert-circle",
  fraud: "alert-octagon",
  order_stuck: "clock",
  ops_no_driver: "clock",
  ops_no_response: "bell-off",
  ops_stale_gps: "wifi-off",
  ops_too_long: "alert-triangle",
  cancellation_refund: "rotate-ccw",
  refund_failed: "alert-triangle",
  chargeback: "alert-octagon",
  new_subscription: "star",
};

export const ALERT_TYPE_META: Record<
  string,
  { label: string; severity: "high" | "medium"; color: string }
> = {
  no_driver: { label: "Alta", severity: "high", color: "#EF4444" },
  stale_gps: { label: "Alta", severity: "high", color: "#F59E0B" },
  no_response: { label: "Media", severity: "medium", color: "#F59E0B" },
  too_long: { label: "Media", severity: "medium", color: "#F59E0B" },
};

export function notifIcon(type: string): string {
  return TYPE_ICON[type] || "bell";
}

export function timeAgo(iso: string | Date): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `hace ${diff}s`;
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
