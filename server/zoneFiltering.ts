import { db } from "./db";
import { orders, businesses, deliveryDrivers } from "@shared/schema-mysql";
import { eq, or, isNull } from "drizzle-orm";

const MAX_DELIVERY_DISTANCE_KM = 999999; // SIN LÍMITE - Muestra todos los pedidos

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Radio de la Tierra en km
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

export async function getAvailableOrdersForDriver(driverId: string) {
  const [driver] = await db
    .select({
      latitude: deliveryDrivers.currentLatitude,
      longitude: deliveryDrivers.currentLongitude,
    })
    .from(deliveryDrivers)
    .where(eq(deliveryDrivers.userId, driverId))
    .limit(1);

  if (!driver) {
    return {
      success: false,
      error: "Driver not found",
      orders: [],
    };
  }

  // If no location, return all available orders without distance filtering
  if (!driver?.latitude || !driver?.longitude) {
    const availableOrders = await db
      .select()
      .from(orders)
      .where(
        or(
          eq(orders.status, "confirmed"),
          eq(orders.status, "ready"),
          eq(orders.status, "preparing"),
        ),
      );

    const ordersWithBusiness = [];
    for (const order of availableOrders) {
      if (order.deliveryPersonId) continue;

      const [business] = await db
        .select({ name: businesses.name })
        .from(businesses)
        .where(eq(businesses.id, order.businessId))
        .limit(1);

      if (business) {
        ordersWithBusiness.push({
          ...order,
          businessName: business.name,
        });
      }
    }

    return {
      success: true,
      orders: ordersWithBusiness,
    };
  }

  const driverLat = parseFloat(driver.latitude);
  const driverLng = parseFloat(driver.longitude);

  const availableOrders = await db
    .select()
    .from(orders)
    .where(
      or(
        eq(orders.status, "confirmed"),
        eq(orders.status, "ready"),
        eq(orders.status, "preparing"),
      ),
    );

  const ordersInZone = [];

  for (const order of availableOrders) {
    if (order.deliveryPersonId) continue;

    const [business] = await db
      .select({
        latitude: businesses.latitude,
        longitude: businesses.longitude,
        name: businesses.name,
      })
      .from(businesses)
      .where(eq(businesses.id, order.businessId))
      .limit(1);

    if (!business?.latitude || !business?.longitude) continue;

    const businessLat = parseFloat(business.latitude);
    const businessLng = parseFloat(business.longitude);

    const distance = calculateDistance(
      driverLat,
      driverLng,
      businessLat,
      businessLng,
    );

    if (distance <= MAX_DELIVERY_DISTANCE_KM) {
      ordersInZone.push({
        ...order,
        businessName: business.name,
        distance: Math.round(distance * 100) / 100,
        estimatedPickupTime: Math.ceil(distance * 3),
      });
    }
  }

  ordersInZone.sort((a, b) => a.distance - b.distance);

  return {
    success: true,
    orders: ordersInZone,
    driverLocation: { latitude: driverLat, longitude: driverLng },
  };
}
