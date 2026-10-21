// Requisitos de verificación para ComeYa (España).
//
// Documentos:
//   Usuario:       DNI/NIE anverso y reverso (obligatorios para todos).
//   Negocio:       certificado de autónomo/empresa + dirección del negocio.
//   Repartidor:    DNI/NIE + autónomo/empresa + foto del vehículo y, para
//                  vehículos con matrícula (moto/coche), permiso de
//                  circulación y matrícula.
//
// No se usan documentos de otros países: ComeYa opera en
// España con DNI/NIE y CIF/NIF de autónomo o empresa.

export interface MissingBusinessDocs {
  businessId: string;
  businessName: string;
  missing: string[];
}

export interface MissingVerificationDocs {
  /** Lista consolidada que se muestra al admin y se envía por push. */
  missing: string[];
  userMissing: string[];
  driverMissing: string[];
  businessMissing: MissingBusinessDocs[];
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

/** Documentos de autónomo/empresa y datos del negocio. */
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

export function getMissingDriverDocs(user: any, driver: any): string[] {
  const missing = getMissingUserDocs(user);
  if (!user?.autonomoDocumentUrl) {
    missing.push("Certificado de autónomo/empresa");
  }
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

/**
 * Calcula los documentos faltantes de un usuario que se está verificando.
 * - Repartidor: DNI/NIE + autónomo + documentos del vehículo.
 * - Dueño: DNI/NIE + autónomo + documentación del negocio seleccionado; si no
 *   se indica negocio, se evalúan todos y se usa el que tenga menos faltantes
 *   para el mensaje (la aprobación sin businessId exige al menos uno completo).
 */
export function getMissingVerificationDocs({
  user,
  driver,
  businesses = [],
  businessId,
}: {
  user: any;
  driver?: any;
  businesses?: any[];
  businessId?: string | null;
}): MissingVerificationDocs {
  const userMissing = getMissingUserDocs(user);
  const isDriver =
    !!driver ||
    normalizeRoleSafe(user?.role) === "delivery_driver" ||
    normalizeRoleSafe(user?.role) === "delivery";

  if (isDriver) {
    const driverMissing = getMissingDriverDocs(user, driver);
    return {
      missing: unique(driverMissing),
      userMissing,
      driverMissing,
      businessMissing: [],
    };
  }

  if (businesses.length === 0) {
    return {
      missing: unique([...userMissing, "Negocio registrado"]),
      userMissing,
      driverMissing: [],
      businessMissing: [],
    };
  }

  const businessMissing: MissingBusinessDocs[] = businesses.map((biz) => ({
    businessId: String(biz.id),
    businessName: String(biz.name ?? "Negocio"),
    missing: getMissingBusinessDocs(biz, user),
  }));

  let selected: MissingBusinessDocs | undefined;
  if (businessId) {
    selected = businessMissing.find((b) => b.businessId === businessId);
  }
  if (!selected) {
    selected = businessMissing
      .slice()
      .sort((a, b) => a.missing.length - b.missing.length)[0];
  }

  // Con businessId se valida ese negocio. Sin businessId, si al menos uno
  // está completo se permite; si ninguno, se reporta el que esté más cerca.
  const businessOk = businessId
    ? (selected?.missing.length ?? 0) === 0
    : businessMissing.some((b) => b.missing.length === 0);

  const businessDocsForMessage = businessOk ? [] : (selected?.missing ?? []);

  return {
    missing: unique([...userMissing, ...businessDocsForMessage]),
    userMissing,
    driverMissing: [],
    businessMissing,
  };
}

function normalizeRoleSafe(role: string | null | undefined): string {
  if (!role) return "customer";
  if (role === "delivery" || role === "driver") return "delivery_driver";
  if (role === "business") return "business_owner";
  return role;
}
