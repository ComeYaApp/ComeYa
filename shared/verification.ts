/**
 * Estado canónico de verificación de usuarios.
 *
 * El flujo nuevo escribe "pending" | "verified" | "rejected". Algunos datos
 * antiguos (seeds, cuentas creadas con el flujo anterior) usan "approved" o
 * "in_review"; se normalizan aquí para que toda la app y el servidor hablen
 * el mismo idioma.
 */
export type VerificationStatus = "pending" | "verified" | "rejected";

export const VERIFICATION_STATUS_META: Record<
  VerificationStatus,
  { label: string; color: string; icon: string }
> = {
  pending: { label: "Pendiente", color: "#F59E0B", icon: "clock" },
  verified: { label: "Verificado", color: "#10B981", icon: "check-circle" },
  rejected: { label: "Rechazado", color: "#EF4444", icon: "x-circle" },
};

export function normalizeVerificationStatus(
  raw: string | null | undefined,
): VerificationStatus {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "verified" || value === "approved" || value === "aprobado") {
    return "verified";
  }
  if (value === "rejected" || value === "rechazado") return "rejected";
  return "pending";
}

export function isVerifiedStatus(raw: string | null | undefined): boolean {
  return normalizeVerificationStatus(raw) === "verified";
}
