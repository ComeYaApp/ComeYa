// Cron de limpieza de reservas pasadas.
//
// Problema que resuelve: en "Mis reservas" (cliente) y en la agenda del
// negocio se acumulaban reservas que nunca llegaron a concretarse — una
// solicitud que el restaurante nunca contestó, o una mesa confirmada a la
// que nadie se presentó. Se quedaban para siempre en el estado activo.
//
// Reglas:
//   pending   + hora pasada  → expired   (nadie la confirmó a tiempo)
//   confirmed + hora pasada  → no_show   (no se presentaron; SIN coste)
//   seated    + hora pasada  → completed (se cerró sola si no la cerraron)
//
// No se cobra ninguna tarifa en estos cierres: la tarifa se cobra al marcar
// "¡Llegó!" (ver PUT /business/:id/action).
import { db } from "./db";
import { reservations, businesses } from "@shared/schema-mysql";
import { and, inArray, lt, eq, sql } from "drizzle-orm";
import { sendPushToUser } from "./enhancedPushService";

// Margen tras la hora reservada antes de dar la mesa por perdida: cubre el
// turno estándar (90 min) más un colchón por si el restaurante la cierra tarde.
const GRACE_MINUTES = 120;

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** Estado final que corresponde a una reserva cuya hora ya pasó. */
function closingStatusFor(status: string): string | null {
  if (status === "pending") return "expired";
  if (status === "confirmed") return "no_show";
  if (status === "seated") return "completed";
  return null;
}

export async function runReservationCleanup(): Promise<number> {
  const now = new Date();
  // Hora local menos el margen, en formato HH:mm del mismo día.
  const cutoffTime = new Date(now.getTime() - GRACE_MINUTES * 60 * 1000);
  const cutoffHHmm = `${String(cutoffTime.getHours()).padStart(2, "0")}:${String(
    cutoffTime.getMinutes(),
  ).padStart(2, "0")}`;
  const today = todayStr();

  // Vencidas: días anteriores, o hoy con la hora ya pasada de largo.
  const stale = await db
    .select()
    .from(reservations)
    .where(
      and(
        inArray(reservations.status as any, ["pending", "confirmed", "seated"]),
        sql`(${reservations.date} < ${today} OR (${reservations.date} = ${today} AND ${reservations.time} < ${cutoffHHmm}))`,
      ),
    )
    .limit(200);

  if (stale.length === 0) return 0;

  let closed = 0;
  for (const r of stale) {
    const next = closingStatusFor(r.status);
    if (!next) continue;
    try {
      await db
        .update(reservations)
        .set({
          status: next,
          updatedAt: new Date(),
          ...(next === "completed" ? { completedAt: new Date() } : {}),
          ...(next === "no_show" ? { noShowAt: new Date() } : {}),
        })
        .where(eq(reservations.id, r.id));
      closed++;

      // Solo se avisa cuando su solicitud caducó sin respuesta: es la única
      // situación en la que el cliente todavía puede reaccionar (reservar en
      // otro sitio). Un no-show no necesita push.
      if (next === "expired") {
        const [biz] = await db
          .select({ name: businesses.name })
          .from(businesses)
          .where(eq(businesses.id, r.businessId))
          .limit(1);
        await sendPushToUser(r.userId, {
          title: "Reserva caducada",
          body: `${biz?.name || "El restaurante"} no confirmó tu reserva del ${r.date} a las ${r.time}. Prueba con otro horario.`,
          data: { reservationId: r.id, screen: "MyReservations" },
        }).catch(() => {});
      }
    } catch (error) {
      console.error(`Error cerrando reserva ${r.id}:`, error);
    }
  }

  if (closed) {
    console.log(`🧹 Reservas pasadas cerradas: ${closed}`);
  }
  return closed;
}

let interval: ReturnType<typeof setInterval> | null = null;

export function startReservationCleanupCron() {
  if (interval) return;
  if (process.env.DISABLE_CLEANUP_CRONS === "true") {
    console.log("🧹 Reservation cleanup cron desactivado (DISABLE_CLEANUP_CRONS)");
    return;
  }
  console.log(
    `🧹 Reservation cleanup cron iniciado (cada 15 min · margen ${GRACE_MINUTES} min)`,
  );
  runReservationCleanup().catch(console.error);
  interval = setInterval(
    () => runReservationCleanup().catch(console.error),
    15 * 60 * 1000,
  );
}

export function stopReservationCleanupCron() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
