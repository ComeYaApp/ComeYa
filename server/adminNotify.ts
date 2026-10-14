// Envío centralizado de push a TODOS los administradores.
// Se usa en eventos clave (pedido nuevo, registros, verificaciones) para que
// el admin se entere aunque tenga la app cerrada. Tolerante a fallos: un
// envío fallido nunca rompe el flujo que lo invoca.
import { db } from "./db";
import { users } from "@shared/schema-mysql";
import { inArray } from "drizzle-orm";

export async function notifyAdminsPush(payload: {
  title: string;
  body: string;
  data?: Record<string, any>;
}): Promise<void> {
  try {
    const { sendPushToUser } = await import("./enhancedPushService");
    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.role, ["admin", "super_admin"]));
    for (const admin of admins) {
      try {
        await sendPushToUser(admin.id, payload);
      } catch {
        // un admin sin token no debe romper el resto
      }
    }
  } catch (e) {
    console.error("notifyAdminsPush error:", e);
  }
}
