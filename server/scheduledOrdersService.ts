import { db } from "./db";
import { scheduledOrders, orders, businesses } from "@shared/schema-mysql";
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
        // Items en JSON: [{ price (euros, comisión incluida), quantity, ... }]
        let items: any[] = [];
        try {
          items = typeof scheduled.items === "string"
            ? JSON.parse(scheduled.items)
            : scheduled.items || [];
          if (!Array.isArray(items)) items = [];
        } catch {
          items = [];
        }

        // Calcular importes en céntimos (mismo modelo que el checkout)
        const subtotal = items.reduce(
          (sum, it) =>
            sum + Math.round((Number(it.price) || 0) * 100 * (Number(it.quantity) || 1)),
          0,
        );
        const productosBase = Math.round(subtotal / 1.15);
        const nemyCommission = subtotal - productosBase;

        const [business] = await db
          .select({
            name: businesses.name,
            image: businesses.image,
            deliveryFee: businesses.deliveryFee,
            ownerId: businesses.ownerId,
          })
          .from(businesses)
          .where(eq(businesses.id, scheduled.businessId))
          .limit(1);

        const deliveryFee = Number(business?.deliveryFee) || 0;
        const total = subtotal + deliveryFee;

        // Crear pedido real con importes completos
        const [order] = await db.insert(orders).values({
          userId: scheduled.userId,
          businessId: scheduled.businessId,
          businessName: business?.name || "Negocio",
          businessImage: business?.image || null,
          items: scheduled.items,
          status: "pending",
          subtotal,
          productosBase,
          nemyCommission,
          deliveryFee,
          total,
          paymentMethod: scheduled.paymentMethod,
          orderType: "delivery",
          deliveryAddress: scheduled.deliveryAddress,
          notes: scheduled.notes || null,
        });

        // Marcar como ejecutado
        await db
          .update(scheduledOrders)
          .set({
            status: "executed",
            orderId: order.insertId,
          })
          .where(eq(scheduledOrders.id, scheduled.id));

        // Notificar al negocio y al cliente
        try {
          const { sendPushToUser } = await import("./enhancedPushService");
          if (business?.ownerId) {
            await sendPushToUser(business.ownerId, {
              title: "🔔 Pedido programado",
              body: `Se ha activado el pedido programado de un cliente. Revísalo y confírmalo.`,
              data: { orderId: String(order.insertId), screen: "BusinessOrders" },
            });
          }
          await sendPushToUser(scheduled.userId, {
            title: "⏰ Pedido programado activado",
            body: `Tu pedido programado en ${business?.name || "el negocio"} ya se ha enviado al local.`,
            data: { orderId: String(order.insertId), screen: "OrderTracking" },
          });
        } catch (notifyError) {
          console.error("Error notifying scheduled order execution:", notifyError);
        }

        results.push({
          scheduledOrderId: scheduled.id,
          orderId: order.insertId,
          success: true,
        });
      } catch (error) {
        console.error("Error executing scheduled order:", error);
        await db
          .update(scheduledOrders)
          .set({ status: "failed" })
          .where(eq(scheduledOrders.id, scheduled.id));

        results.push({ scheduledOrderId: scheduled.id, success: false, error });
      }
    }

    return results;
  }
}
