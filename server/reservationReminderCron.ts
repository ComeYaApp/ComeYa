// Recordatorio de reservas: 2 horas antes de la hora reservada, la cliente o
// cliente recibe un push "recuerda tu reserva". Solo reservas confirmadas (una
// pendiente aún no es segura) y reservas hechas con más de 2h de antelación
// (si reservó hace un rato, el push de confirmación sigue reciente). El guard
// de deduplicación es reminder_sent_at en la propia fila: sobrevive reinicios.
import cron from "node-cron";
import { db } from "./db";
import { reservations, businesses } from "@shared/schema-mysql";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { sendPushToUser } from "./enhancedPushService";
import { zonedNow } from "./reservationAvailabilityService";

const REMINDER_MINUTES_BEFORE = 120;

function minutesOf(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || "");
  if (!m) return NaN;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

export function startReservationReminderCron() {
  cron.schedule("*/10 * * * *", async () => {
    try {
      const now = zonedNow();
      const nowMinutes = now.minutes;

      const rows = await db
        .select({
          reservation: reservations,
          businessName: businesses.name,
        })
        .from(reservations)
        .leftJoin(businesses, eq(businesses.id, reservations.businessId))
        .where(
          and(
            eq(reservations.date, now.dateStr),
            eq(reservations.status, "confirmed"),
            isNull(reservations.reminderSentAt),
          ),
        )
        .limit(100);

      for (const { reservation: r, businessName } of rows) {
        const slotMinutes = minutesOf(r.time);
        if (!Number.isFinite(slotMinutes)) continue;

        const windowStart = slotMinutes - REMINDER_MINUTES_BEFORE;
        if (nowMinutes < windowStart || nowMinutes >= slotMinutes) continue;

        // Reservas creadas con menos de 2h de antelación no se recuerdan
        const createdAt = r.createdAt ? new Date(r.createdAt) : null;
        if (createdAt) {
          const createdMinutes =
            createdAt.getHours() * 60 + createdAt.getMinutes();
          if (
            createdMinutes > windowStart &&
            createdAt.toDateString() === new Date().toDateString()
          ) {
            // Se creó dentro de la ventana de recordatorio: marcar como
            // recordada para no volver a evaluarla
            await db
              .update(reservations)
              .set({ reminderSentAt: new Date() })
              .where(eq(reservations.id, r.id));
            continue;
          }
        }

        await sendPushToUser(r.userId, {
          title: "⏰ Recuerda tu reserva",
          body: `Tienes una mesa reservada en ${businessName || "el restaurante"} hoy a las ${r.time} (${r.partySize} ${r.partySize === 1 ? "persona" : "personas"}). ¡Te esperamos!`,
          data: { reservationId: r.id, screen: "MyReservations" },
        });

        await db
          .update(reservations)
          .set({ reminderSentAt: new Date() })
          .where(eq(reservations.id, r.id));

        console.log(
          `📅 Reservation reminder sent ${r.code || r.id.slice(-6)} → user ${r.userId}`,
        );
      }
    } catch (err) {
      console.error("Reservation reminder cron error:", (err as Error).message);
    }
  });

  console.log("📅 Reservation reminder cron scheduled (*/10 * * * *)");
}
