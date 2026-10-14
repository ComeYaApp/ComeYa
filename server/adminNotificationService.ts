// Centro de avisos del admin — servicio único.
// Todo evento dirigido al admin pasa por aquí: se PERSISTE en BD (historial),
// se emite por socket a la sala "admins" (panel en vivo) y opcionalmente se
// envía push (app cerrada). Antes cada emisor hacía su propia llamada suelta
// (socket o push) y muchos eventos se perdían o llegaban sin acción.
import { db } from "./db";
import { adminNotifications, adminAlertMutes } from "@shared/schema-mysql";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { logger } from "./logger";

export type AdminNotifSeverity = "critical" | "high" | "medium";

export interface RecordAdminNotificationInput {
  type: string;
  title: string;
  body?: string;
  severity?: AdminNotifSeverity;
  /** Sección del panel a la que lleva el botón "Ver" */
  section?: string;
  data?: Record<string, any>;
  /** Clave de deduplicación (p.ej. `ops_no_driver:<orderId>`) */
  entityKey?: string;
  /** Enviar push (app cerrada). Por defecto true. */
  push?: boolean;
  /** Emitir por socket a la sala admins. Por defecto true. */
  socket?: boolean;
  /** Si ya existe un aviso sin resolver con este entityKey, no crear otro */
  dedupeActive?: boolean;
}

export async function recordAdminNotification(
  input: RecordAdminNotificationInput,
): Promise<any | null> {
  const {
    type,
    title,
    body = null,
    severity = "medium",
    section = null,
    data = null,
    entityKey = null,
    push = true,
    socket = true,
    dedupeActive = false,
  } = input;

  try {
    // Dedupe de alertas activas: una por entityKey hasta resolverse
    if (dedupeActive && entityKey) {
      const existing = await db
        .select({ id: adminNotifications.id })
        .from(adminNotifications)
        .where(
          and(
            eq(adminNotifications.entityKey, entityKey),
            isNull(adminNotifications.resolvedAt),
          ),
        )
        .limit(1);
      if (existing.length > 0) return null;
    }

    const row = {
      id: crypto.randomUUID(),
      type,
      severity,
      title,
      body,
      section,
      data: data ? JSON.stringify(data) : null,
      entityKey,
    };

    await db.insert(adminNotifications).values(row as any);

    const payload = {
      id: row.id,
      type,
      severity,
      title,
      body,
      section,
      data,
      createdAt: new Date().toISOString(),
    };

    if (socket) {
      try {
        const { notifyAdmins } = await import("./websocket");
        notifyAdmins({ ...payload } as any);
      } catch {
        /* socket no inicializado (scripts/tests) */
      }
    }

    if (push) {
      try {
        const { notifyAdminsPush } = await import("./adminNotify");
        await notifyAdminsPush({
          title,
          body: body || title,
          data: { screen: "AdminPanel", section: section || undefined },
        });
      } catch (e) {
        console.error("recordAdminNotification push error:", e);
      }
    }

    return payload;
  } catch (e) {
    logger.error("recordAdminNotification error", e, { type, title });
    return null;
  }
}

// ── Consultas del historial ──────────────────────────────────────────────────

export async function listAdminNotifications(opts: {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
  severity?: string;
  includeResolved?: boolean;
}) {
  const {
    limit = 50,
    offset = 0,
    unreadOnly = false,
    severity,
    includeResolved = true,
  } = opts;

  const conditions: any[] = [];
  if (unreadOnly) conditions.push(isNull(adminNotifications.readAt));
  if (severity) conditions.push(eq(adminNotifications.severity, severity));
  if (!includeResolved) conditions.push(isNull(adminNotifications.resolvedAt));

  let query: any = db.select().from(adminNotifications);
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }
  const rows = await query
    .orderBy(desc(adminNotifications.createdAt))
    .limit(Math.min(limit, 200))
    .offset(offset);

  return rows.map((r: any) => ({
    ...r,
    data: r.data ? safeParse(r.data) : null,
  }));
}

export async function adminNotificationsUnreadCount(): Promise<number> {
  const [row] = await db
    .select({ cnt: sql<number>`COUNT(*)` })
    .from(adminNotifications)
    .where(and(isNull(adminNotifications.readAt), isNull(adminNotifications.resolvedAt)));
  return Number(row?.cnt) || 0;
}

export async function markAdminNotificationRead(id: string) {
  await db
    .update(adminNotifications)
    .set({ readAt: new Date() } as any)
    .where(eq(adminNotifications.id, id));
}

export async function markAllAdminNotificationsRead() {
  await db
    .update(adminNotifications)
    .set({ readAt: new Date() } as any)
    .where(isNull(adminNotifications.readAt));
}

/** Marca como resueltos los avisos de un entityKey (p. ej. alerta de ops que ya no aplica) */
export async function resolveAdminNotificationsByEntity(
  entityKeyPrefix: string,
  activeEntityKeys: string[],
) {
  const active = new Set(activeEntityKeys);
  const open = await db
    .select({ id: adminNotifications.id, entityKey: adminNotifications.entityKey })
    .from(adminNotifications)
    .where(
      and(
        isNull(adminNotifications.resolvedAt),
        sql`${adminNotifications.entityKey} LIKE ${entityKeyPrefix + "%"}`,
      ),
    );
  const toResolve = open.filter(
    (r: any) => r.entityKey && !active.has(r.entityKey),
  );
  for (const r of toResolve) {
    await db
      .update(adminNotifications)
      .set({ resolvedAt: new Date() } as any)
      .where(eq(adminNotifications.id, r.id));
  }
  return toResolve.length;
}

// ── Silenciar alertas de operación ───────────────────────────────────────────

export async function muteAdminAlert(
  orderId: string,
  alertType: string,
  minutes: number,
) {
  const until = new Date(Date.now() + Math.max(5, minutes) * 60 * 1000);
  const existing = await db
    .select({ id: adminAlertMutes.id })
    .from(adminAlertMutes)
    .where(
      and(
        eq(adminAlertMutes.orderId, orderId),
        eq(adminAlertMutes.alertType, alertType),
      ),
    )
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(adminAlertMutes)
      .set({ mutedUntil: until } as any)
      .where(eq(adminAlertMutes.id, existing[0].id));
  } else {
    await db.insert(adminAlertMutes).values({
      id: crypto.randomUUID(),
      orderId,
      alertType,
      mutedUntil: until,
    } as any);
  }
}

/** Mutes activos: Set con claves `${orderId}:${alertType}` */
export async function getActiveAdminAlertMutes(): Promise<Set<string>> {
  try {
    const rows = await db
      .select({
        orderId: adminAlertMutes.orderId,
        alertType: adminAlertMutes.alertType,
      })
      .from(adminAlertMutes)
      .where(gt(adminAlertMutes.mutedUntil, new Date()));
    return new Set(rows.map((r: any) => `${r.orderId}:${r.alertType}`));
  } catch {
    return new Set();
  }
}

// Marcar como leído automáticamente las alertas ops ya resueltas (limpieza)
export async function cleanupResolvedRead() {
  try {
    await db
      .update(adminNotifications)
      .set({ readAt: new Date() } as any)
      .where(
        and(
          isNull(adminNotifications.readAt),
          sql`${adminNotifications.resolvedAt} < ${new Date(Date.now() - 24 * 60 * 60 * 1000)}`,
        ),
      );
  } catch {
    /*silencioso*/
  }
}

function safeParse(value: string): any {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
