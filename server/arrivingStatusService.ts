import { db } from "./db";
import { orders, deliveryDrivers } from "@shared/schema-mysql";
import { eq, and, inArray } from "drizzle-orm";

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export async function checkAndUpdateArrivingStatus(
  orderId: string,
  driverLat: number,
  driverLng: number,
): Promise<boolean> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order || !order.deliveryLatitude || !order.deliveryLongitude) {
    return false;
  }

  // Solo actualizar si está en camino
  if (!["picked_up", "on_the_way", "in_transit"].includes(order.status)) {
    return false;
  }

  const deliveryLat = parseFloat(order.deliveryLatitude);
  const deliveryLng = parseFloat(order.deliveryLongitude);

  const distance = calculateDistance(
    driverLat,
    driverLng,
    deliveryLat,
    deliveryLng,
  );

  // Si está a menos de 500 metros (0.5 km), marcar como "arriving"
  if (distance <= 0.5) {
    await db
      .update(orders)
      .set({ status: "arriving" })
      .where(eq(orders.id, orderId));

    return true;
  }

  return false;
}

export async function checkAllActiveOrdersForArriving(): Promise<void> {
  const activeOrders = await db
    .select()
    .from(orders)
    .where(
      and(
        inArray(orders.status, ["picked_up", "on_the_way", "in_transit"]),
        eq(orders.deliveryPersonId, null as any), // Tiene driver asignado
      ),
    );

  for (const order of activeOrders) {
    if (!order.deliveryPersonId) continue;

    const [driver] = await db
      .select()
      .from(deliveryDrivers)
      .where(eq(deliveryDrivers.userId, order.deliveryPersonId))
      .limit(1);

    if (
      driver &&
      driver.currentLatitude &&
      driver.currentLongitude &&
      order.deliveryLatitude &&
      order.deliveryLongitude
    ) {
      await checkAndUpdateArrivingStatus(
        order.id,
        parseFloat(driver.currentLatitude),
        parseFloat(driver.currentLongitude),
      );
    }
  }
}
