import { db } from "./db";
import { orders, deliveryDrivers } from "@shared/schema-mysql";
import { eq, and, inArray, lt } from "drizzle-orm";
import { logger } from "./logger";

interface DriverScore {
  driverId: string;
  distance: number;
  rating: number;
  completedOrders: number;
  score: number;
}

export async function assignBestDriver(
  orderId: string,
  businessLat: number,
  businessLng: number,
) {
  try {
    const availableDrivers = await db
      .select({
        id: deliveryDrivers.userId,
        latitude: deliveryDrivers.currentLatitude,
        longitude: deliveryDrivers.currentLongitude,
        rating: deliveryDrivers.rating,
        completedOrders: deliveryDrivers.totalDeliveries,
      })
      .from(deliveryDrivers)
      .where(
        and(
          eq(deliveryDrivers.isAvailable, true),
          lt(deliveryDrivers.strikes, 3),
          eq(deliveryDrivers.isBlocked, false),
        ),
      );

    if (!availableDrivers || availableDrivers.length === 0) {
      return { success: false, error: "No drivers available" };
    }

    const scored: DriverScore[] = availableDrivers
      .filter((driver) => driver.latitude && driver.longitude)
      .map((driver) => {
        const distance = calculateDistance(
          businessLat,
          businessLng,
          parseFloat(driver.latitude!),
          parseFloat(driver.longitude!),
        );
        const distanceScore = Math.max(0, 100 - distance * 10);
        const ratingScore = ((driver.rating || 40) / 10) * 20;
        const experienceScore = Math.min(driver.completedOrders || 0, 50);

        return {
          driverId: driver.id,
          distance,
          rating: (driver.rating || 0) / 10,
          completedOrders: driver.completedOrders || 0,
          score:
            distanceScore * 0.5 + ratingScore * 0.3 + experienceScore * 0.2,
        };
      });

    if (scored.length === 0) {
      return { success: false, error: "No drivers with location available" };
    }

    scored.sort((a, b) => b.score - a.score);
    const bestDriver = scored[0];

    await db
      .update(orders)
      .set({
        deliveryPersonId: bestDriver.driverId,
        status: "assigned",
        assignedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    logger.info("Driver assigned", {
      orderId,
      driverId: bestDriver.driverId,
      score: bestDriver.score,
    });
    return {
      success: true,
      driverId: bestDriver.driverId,
      distance: bestDriver.distance,
    };
  } catch (error: any) {
    logger.error("Assignment failed", error);
    return { success: false, error: error.message };
  }
}

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function handleMultipleOrders(driverId: string) {
  const activeOrders = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.deliveryPersonId, driverId),
        inArray(orders.status, ["assigned", "picked_up"]),
      ),
    );

  return {
    success: true,
    activeOrders: activeOrders.length,
    orders: activeOrders,
  };
}
