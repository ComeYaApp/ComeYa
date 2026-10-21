import {
  normalizeVerificationStatus,
  VERIFICATION_STATUS_META,
  type VerificationStatus,
} from "@shared/verification";

export type StatusMeta = {
  label: string;
  color: string;
  icon: string;
};

/**
 * Mapa tolerante: incluye los estados canónicos y alias antiguos para que un
 * dato inesperado nunca rompa el render (cfg.color sobre undefined).
 */
export const STATUS_CONFIG: Record<string, StatusMeta> = {
  ...VERIFICATION_STATUS_META,
  approved: VERIFICATION_STATUS_META.verified,
  in_review: VERIFICATION_STATUS_META.pending,
  aprobado: VERIFICATION_STATUS_META.verified,
};

export function statusMeta(raw: string | null | undefined): StatusMeta {
  const status: VerificationStatus = normalizeVerificationStatus(raw);
  return STATUS_CONFIG[status] ?? VERIFICATION_STATUS_META.pending;
}

export function isDriverUser(user: any): boolean {
  if (!user) return false;
  return (
    user.role === "delivery_driver" ||
    user.role === "delivery" ||
    user.role === "driver" ||
    !!user.deliveryDriver
  );
}

export function isBusinessUser(user: any): boolean {
  if (!user) return false;
  return (
    user.role === "business_owner" ||
    user.role === "business" ||
    !!user.business ||
    (Array.isArray(user.businesses) && user.businesses.length > 0)
  );
}

export function roleLabel(user: any): string {
  if (isDriverUser(user)) return "Repartidor";
  if (isBusinessUser(user)) return "Negocio";
  if (user?.role === "customer") return "Cliente";
  return user?.role || "—";
}

export function getAllBusinesses(user: any): any[] {
  if (Array.isArray(user?.businesses) && user.businesses.length > 0) {
    return user.businesses;
  }
  return user?.business ? [user.business] : [];
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export function getMissingUserDocs(user: any): string[] {
  const missing: string[] = [];
  if (!user?.idDocumentUrl) missing.push("DNI/NIE (anverso)");
  if (!user?.idDocumentBackUrl) missing.push("DNI/NIE (reverso)");
  return missing;
}

export function getMissingBusinessDocs(
  business: any,
  user: any,
): string[] {
  if (!business) return ["Negocio registrado"];
  const missing: string[] = [];
  if (!user?.autonomoDocumentUrl) {
    missing.push("Certificado de autónomo/empresa");
  }
  if (!business.address) missing.push("Dirección del negocio");
  return unique(missing);
}

export function getMissingDriverDocs(user: any): string[] {
  const missing = getMissingUserDocs(user);
  if (!user?.autonomoDocumentUrl) {
    missing.push("Certificado de autónomo/empresa");
  }
  const driver = user?.deliveryDriver;
  if (!driver) {
    missing.push("Datos del vehículo");
    return unique(missing);
  }
  if (!driver.vehicleType) missing.push("Tipo de vehículo");
  if (!driver.vehiclePhoto) missing.push("Foto del vehículo");
  const requiresPlate = ["moped", "motorcycle", "car"].includes(
    String(driver.vehicleType),
  );
  if (requiresPlate && !driver.vehicleLicensePhoto) {
    missing.push("Permiso de circulación");
  }
  if (requiresPlate && !driver.vehiclePlate) {
    missing.push("Matrícula");
  }
  return unique(missing);
}

export interface MissingSummary {
  missing: string[];
  userMissing: string[];
  driverMissing: string[];
  businesses: Array<{
    id: string;
    name: string;
    missing: string[];
  }>;
}

/**
 * Calcula los faltantes para mostrar en la lista y el detalle. Si se indica
 * businessId se evalúa ese negocio; si no, se usa el primero como resumen.
 */
export function getMissingSummary(
  user: any,
  businessId?: string | null,
): MissingSummary {
  const userMissing = getMissingUserDocs(user);

  if (isDriverUser(user)) {
    const driverMissing = getMissingDriverDocs(user);
    return {
      missing: driverMissing,
      userMissing,
      driverMissing,
      businesses: [],
    };
  }

  const businesses = getAllBusinesses(user).map((biz: any) => ({
    id: String(biz.id),
    name: String(biz.name ?? "Negocio"),
    missing: getMissingBusinessDocs(biz, user),
  }));

  if (businesses.length === 0) {
    return {
      missing: unique([...userMissing, "Negocio registrado"]),
      userMissing,
      driverMissing: [],
      businesses: [],
    };
  }

  const selected =
    (businessId && businesses.find((b) => b.id === businessId)) ||
    businesses[0];
  const businessOk = businessId
    ? selected.missing.length === 0
    : businesses.some((b) => b.missing.length === 0);

  return {
    missing: unique([
      ...userMissing,
      ...(businessOk ? [] : selected.missing),
    ]),
    userMissing,
    driverMissing: [],
    businesses,
  };
}
