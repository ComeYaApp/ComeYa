import { db } from "./db";
import { scheduledOrders, orders } from "@shared/schema-mysql";
import { eq, and, lte, gte } from "drizzle-orm";

export class ScheduledOrdersService {
  // Crear pedido programado
  static async createScheduledOrder(data: {
    userId: string;
    businessId: string;
    items: any[] | string;
    scheduledFor?: Date | string;
    scheduledDate?: Date | string;
    deliveryAddress?: string;
    deliveryLatitude?: string;
    deliveryLongitude?: string;
    paymentMethod?: string;
    notes?: string;
  }) {
    // Normalizar payload del cliente (scheduledDate/items-string/dirección opcional)
    const itemsRaw = Array.isArray(data.items)
      ? JSON.stringify(data.items)
      : typeof data.items === "string"
        ? data.items
        : "[]";
    const scheduledFor = data.scheduledFor || data.scheduledDate;

    const [scheduled] = await db.insert(scheduledOrders).values({
      userId: data.userId,
      businessId: data.businessId,
      items: itemsRaw,
      scheduledFor: new Date(scheduledFor as any),
      deliveryAddress: data.deliveryAddress || "Pendiente de confirmar",
      deliveryLatitude: data.deliveryLatitude || null,
      deliveryLongitude: data.deliveryLongitude || null,
      paymentMethod: data.paymentMethod || "card",
      notes: data.notes || null,
      status: "pending",
    });

    return { success: true, scheduledOrderId: scheduled.insertId };
  }

  // Obtener pedidos programados del usuario
  static async getUserScheduledOrders(userId: string) {
    const scheduled = await db
      .select()
      .from(scheduledOrders)
      .where(
        and(
          eq(scheduledOrders.userId, userId),
          eq(scheduledOrders.status, "pending"),
        ),
      );

    return scheduled;
  }

  // Cancelar pedido programado
  static async cancelScheduledOrder(scheduledOrderId: string, userId: string) {
    await db
      .update(scheduledOrders)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(scheduledOrders.id, scheduledOrderId),
          eq(scheduledOrders.userId, userId),
        ),
      );

    return { success: true };
  }

  // Ejecutar pedidos programados (cron job)
  static async executeScheduledOrders() {
    const now = new Date();
    const pending = await db
      .select()
      .from(scheduledOrders)
      .where(
        and(
          eq(scheduledOrders.status, "pending"),
          lte(scheduledOrders.scheduledFor, now),
        ),
      );

    const results = [];

    for (const scheduled of pending) {
      try {
        // Crear pedido real
        const [order] = await db.insert(orders).values({
          userId: scheduled.userId,
          businessId: scheduled.businessId,
          items: scheduled.items,
          deliveryAddressId: scheduled.deliveryAddressId,
          paymentMethod: scheduled.paymentMethod,
          notes: scheduled.notes,
          status: "pending",
        });

        // Marcar como ejecutado
        await db
          .update(scheduledOrders)
          .set({
            status: "executed",
            executedOrderId: order.insertId,
          })
          .where(eq(scheduledOrders.id, scheduled.id));

        // Si es recurrente, crear siguiente instancia
        if (scheduled.recurringPattern) {
          const nextDate = this.calculateNextOccurrence(
            scheduled.scheduledFor,
            scheduled.recurringPattern,
            scheduled.recurringDays
              ? JSON.parse(scheduled.recurringDays)
              : null,
          );

          if (
            nextDate &&
            (!scheduled.recurringEndDate ||
              nextDate <= scheduled.recurringEndDate)
          ) {
            await db.insert(scheduledOrders).values({
              userId: scheduled.userId,
              businessId: scheduled.businessId,
              items: scheduled.items,
              scheduledFor: nextDate,
              recurringPattern: scheduled.recurringPattern,
              recurringDays: scheduled.recurringDays,
              recurringEndDate: scheduled.recurringEndDate,
              deliveryAddressId: scheduled.deliveryAddressId,
              paymentMethod: scheduled.paymentMethod,
              notes: scheduled.notes,
              status: "pending",
            });
          }
        }

        results.push({
          scheduledOrderId: scheduled.id,
          orderId: order.insertId,
          success: true,
        });
      } catch (error) {
        await db
          .update(scheduledOrders)
          .set({ status: "failed" })
          .where(eq(scheduledOrders.id, scheduled.id));

        results.push({ scheduledOrderId: scheduled.id, success: false, error });
      }
    }

    return results;
  }

  // Calcular próxima ocurrencia
  private static calculateNextOccurrence(
    currentDate: Date,
    pattern: "daily" | "weekly" | "monthly",
    days?: number[],
  ): Date {
    const next = new Date(currentDate);

    switch (pattern) {
      case "daily":
        next.setDate(next.getDate() + 1);
        break;
      case "weekly":
        next.setDate(next.getDate() + 7);
        break;
      case "monthly":
        next.setMonth(next.getMonth() + 1);
        break;
    }

    return next;
  }
}
