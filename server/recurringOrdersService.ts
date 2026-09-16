// Pedidos programados recurrentes (semanales).
// Cada recurrencia, al llegar su momento, materializa un scheduled_order
// normal: el job de cada 5 minutos (executeScheduledOrdersJob) lo convierte
// en pedido real con el flujo de siempre (notificación al negocio, pago…).
import { db } from "./db";
import {
  recurringOrders,
  scheduledOrders,
  businesses,
} from "@shared/schema-mysql";
import { eq, and, lte } from "drizzle-orm";

const DAY_NAMES = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

export class RecurringOrdersService {
  // Siguiente ejecución: próxima fecha entre los días elegidos a la hora
  // configurada, en la zona de Madrid
  static nextRun(
    daysOfWeek: number[],
    scheduledTime: string,
    after: Date = new Date(),
  ): Date | null {
    const days = (daysOfWeek || [])
      .map(Number)
      .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    if (days.length === 0) return null;
    const [hh, mm] = String(scheduledTime || "12:00").split(":");
    for (let offset = 0; offset < 8; offset++) {
      const candidate = new Date(after);
      candidate.setDate(candidate.getDate() + offset);
      if (!days.includes(candidate.getDay())) continue;
      candidate.setHours(Number(hh) || 12, Number(mm) || 0, 0, 0);
      if (candidate > after) return candidate;
    }
    return null;
  }

  static async create(data: {
    userId: string;
    businessId: string;
    businessName?: string;
    items: string;
    daysOfWeek: string;
    scheduledTime: string;
    deliveryAddress?: string;
    notes?: string;
    paymentMethod?: string;
  }) {
    let days: number[] = [];
    try {
      days = JSON.parse(data.daysOfWeek || "[]");
    } catch {}
    const nextRunAt = this.nextRun(days, data.scheduledTime);
    if (!nextRunAt) {
      return { success: false, error: "Elige al menos un día de la semana" };
    }

    const [biz] = await db
      .select({ name: businesses.name })
      .from(businesses)
      .where(eq(businesses.id, data.businessId))
      .limit(1);

    const id = crypto.randomUUID();
    await db.insert(recurringOrders).values({
      id,
      userId: data.userId,
      businessId: data.businessId,
      businessName: data.businessName || biz?.name || null,
      items: data.items,
      daysOfWeek: data.daysOfWeek,
      scheduledTime: String(data.scheduledTime).slice(0, 5),
      deliveryAddress: data.deliveryAddress || null,
      notes: data.notes || null,
      paymentMethod: data.paymentMethod || "stripe_card",
      nextRunAt,
    });

    return { success: true, recurringOrderId: id };
  }

  static async listForUser(userId: string) {
    const rows = await db
      .select()
      .from(recurringOrders)
      .where(
        and(
          eq(recurringOrders.userId, userId),
          eq(recurringOrders.status, "active"),
        ),
      );
    return rows.map((r: any) => ({
      ...r,
      daysOfWeekLabel: this.daysLabel(r.daysOfWeek),
    }));
  }

  static daysLabel(daysOfWeekJson: string): string {
    try {
      const days: number[] = JSON.parse(daysOfWeekJson || "[]");
      return days
        .sort()
        .map((d) => DAY_NAMES[d])
        .join(", ");
    } catch {
      return "";
    }
  }

  static async cancel(id: string, userId: string) {
    const [row] = await db
      .select()
      .from(recurringOrders)
      .where(eq(recurringOrders.id, id))
      .limit(1);
    if (!row || row.userId !== userId) {
      return { success: false, error: "Pedido recurrente no encontrado" };
    }
    await db
      .update(recurringOrders)
      .set({ status: "cancelled" })
      .where(eq(recurringOrders.id, id));
    return { success: true };
  }

  // Materializa las recurrencias vencidas en scheduled_orders y adelanta
  // next_run_at al siguiente día elegido
  static async executeDueRecurring(): Promise<number> {
    const due = await db
      .select()
      .from(recurringOrders)
      .where(
        and(
          eq(recurringOrders.status, "active"),
          lte(recurringOrders.nextRunAt, new Date()),
        ),
      )
      .limit(20);

    let executed = 0;
    for (const rec of due) {
      try {
        let days: number[] = [];
        try {
          days = JSON.parse(rec.daysOfWeek || "[]");
        } catch {}
        const [hh, mm] = String(rec.scheduledTime).split(":");
        const scheduledFor = new Date();
        scheduledFor.setHours(Number(hh) || 12, Number(mm) || 0, 0, 0);

        // El materializador de scheduled orders requiere fecha futura: si ya
        // pasó la hora de hoy, la próxima ejecución válida es otro día
        const today = new Date();
        today.setHours(23, 59, 59, 0);
        const targetFor =
          scheduledFor > new Date() ? scheduledFor : new Date(Date.now() + 60000);

        await db.insert(scheduledOrders).values({
          userId: rec.userId,
          businessId: rec.businessId,
          items: rec.items,
          scheduledFor: targetFor,
          deliveryAddress: rec.deliveryAddress || "Dirección guardada",
          paymentMethod: rec.paymentMethod || "stripe_card",
          notes: rec.notes || "Pedido recurrente semanal",
        });

        const nextRunAt = this.nextRun(days, rec.scheduledTime);
        await db
          .update(recurringOrders)
          .set({ nextRunAt })
          .where(eq(recurringOrders.id, rec.id));
        executed++;
      } catch (err) {
        console.error("Error materializando pedido recurrente:", err);
      }
    }
    return executed;
  }
}
