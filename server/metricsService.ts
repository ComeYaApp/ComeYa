import { db } from "./db";
import { orders, businesses, deliveryDrivers } from "@shared/schema-mysql";
import { eq, and, sql } from "drizzle-orm";

export async function updateBusinessPrepTimeMetrics(
  businessId: string,
): Promise<void> {
  const completedOrders = await db
    .select()
    .from(orders)
    .where(
      sql`business_id = ${businessId} AND status = 'delivered' AND actual_prep_time IS NOT NULL`,
    )
    .limit(50);

  if (completedOrders.length === 0) return;

  const avgPrepTime = Math.round(
    completedOrders.reduce((sum, o) => sum + (o.actualPrepTime || 0), 0) /
      completedOrders.length,
  );

  await db
    .update(businesses)
    .set({ avgPrepTime })
    .where(eq(businesses.id, businessId));

  console.log(
    `📊 Business ${businessId} avg prep time updated: ${avgPrepTime} min`,
  );
}

export async function updateDriverSpeedMetrics(
  driverId: string,
): Promise<void> {
  const completedDeliveries = await db
    .select()
    .from(orders)
    .where(
      sql`delivery_person_id = ${driverId} AND status = 'delivered' AND actual_delivery_time IS NOT NULL`,
    )
    .limit(50);

  if (completedDeliveries.length === 0) return;

  // Calcular velocidad promedio basada en distancia y tiempo
  let totalSpeed = 0;
  let validDeliveries = 0;

  for (const order of completedDeliveries) {
    if (order.actualDeliveryTime && order.actualDeliveryTime > 0) {
      // Estimar distancia (simplificado, en producción usar distancia real)
      const estimatedDistance = 3; // km promedio
      const timeInHours = order.actualDeliveryTime / 60;
      const speed = estimatedDistance / timeInHours;

      if (speed > 5 && speed < 60) {
        // Filtrar valores irreales
        totalSpeed += speed;
        validDeliveries++;
      }
    }
  }

  if (validDeliveries > 0) {
    const avgSpeed = totalSpeed / validDeliveries;
    await db
      .update(deliveryDrivers)
      .set({ avgSpeed: Math.round(avgSpeed * 100) / 100 })
      .where(eq(deliveryDrivers.userId, driverId));

    console.log(
      `📊 Driver ${driverId} avg speed updated: ${avgSpeed.toFixed(2)} km/h`,
    );
  }
}

export async function calculateETAAccuracy(orderId: string): Promise<number> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (
    !order ||
    !order.estimatedTotalTime ||
    !order.deliveredAt ||
    !order.createdAt
  ) {
    return 0;
  }

  const actualTime = Math.floor(
    (new Date(order.deliveredAt).getTime() -
      new Date(order.createdAt).getTime()) /
      60000,
  );

  const estimatedTime = order.estimatedTotalTime;
  const difference = Math.abs(actualTime - estimatedTime);
  const accuracy = Math.max(0, 100 - (difference / estimatedTime) * 100);

  return Math.round(accuracy);
}
