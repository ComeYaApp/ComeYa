import { db } from "./db";
import { businesses, deliveryDrivers, orders } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";

// Calcular distancia entre dos puntos (Haversine)
function calculateDistance(
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

export interface ETACalculation {
  prepTime: number; // minutos
  deliveryTime: number; // minutos
  totalTime: number; // minutos
  buffer: number; // minutos
  estimatedArrival: Date;
  distance: number; // km
}

export async function calculateDynamicETA(
  businessId: string,
  deliveryLat: number,
  deliveryLng: number,
  driverId?: string,
): Promise<ETACalculation> {
  // 1. Obtener tiempo de preparación del negocio
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  const prepTime = business?.avgPrepTime || 20;

  // 2. Obtener ubicación del negocio
  const businessLat = business?.latitude ? parseFloat(business.latitude) : 0;
  const businessLng = business?.longitude ? parseFloat(business.longitude) : 0;

  // 3. Calcular distancia
  const distance = calculateDistance(
    businessLat,
    businessLng,
    deliveryLat,
    deliveryLng,
  );

  // 4. Obtener velocidad del driver (si está asignado)
  let driverSpeed = 25; // km/h por defecto
  if (driverId) {
    const [driver] = await db
      .select()
      .from(deliveryDrivers)
      .where(eq(deliveryDrivers.userId, driverId))
      .limit(1);
    driverSpeed = driver?.avgSpeed
      ? parseFloat(driver.avgSpeed.toString())
      : 25;
  }

  // 5. Calcular tiempo de entrega
  const deliveryTime = Math.ceil((distance / driverSpeed) * 60); // minutos

  // 6. Buffer de seguridad
  const buffer = 5;

  // 7. Tiempo total
  const totalTime = prepTime + deliveryTime + buffer;

  // 8. Hora estimada de llegada
  const estimatedArrival = new Date();
  estimatedArrival.setMinutes(estimatedArrival.getMinutes() + totalTime);

  return {
    prepTime,
    deliveryTime,
    totalTime,
    buffer,
    estimatedArrival,
    distance: Math.round(distance * 10) / 10,
  };
}

export async function updateOrderETA(orderId: string): Promise<void> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return;

  const deliveryLat = order.deliveryLatitude
    ? parseFloat(order.deliveryLatitude)
    : 0;
  const deliveryLng = order.deliveryLongitude
    ? parseFloat(order.deliveryLongitude)
    : 0;

  const eta = await calculateDynamicETA(
    order.businessId,
    deliveryLat,
    deliveryLng,
    order.deliveryPersonId || undefined,
  );

  await db
    .update(orders)
    .set({
      estimatedPrepTime: eta.prepTime,
      estimatedDeliveryTime: eta.deliveryTime,
      estimatedTotalTime: eta.totalTime,
      estimatedDelivery: eta.estimatedArrival,
    })
    .where(eq(orders.id, orderId));
}

export async function recalculateETAWithDriverLocation(
  orderId: string,
  driverLat: number,
  driverLng: number,
): Promise<ETACalculation> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    throw new Error("Order not found");
  }

  const deliveryLat = order.deliveryLatitude
    ? parseFloat(order.deliveryLatitude)
    : 0;
  const deliveryLng = order.deliveryLongitude
    ? parseFloat(order.deliveryLongitude)
    : 0;

  // Calcular distancia desde ubicación actual del driver
  const distance = calculateDistance(
    driverLat,
    driverLng,
    deliveryLat,
    deliveryLng,
  );

  const [driver] = await db
    .select()
    .from(deliveryDrivers)
    .where(eq(deliveryDrivers.userId, order.deliveryPersonId!))
    .limit(1);

  const driverSpeed = driver?.avgSpeed
    ? parseFloat(driver.avgSpeed.toString())
    : 25;
  const deliveryTime = Math.ceil((distance / driverSpeed) * 60);
  const buffer = 2; // Buffer menor cuando ya está en camino

  const totalTime = deliveryTime + buffer;
  const estimatedArrival = new Date();
  estimatedArrival.setMinutes(estimatedArrival.getMinutes() + totalTime);

  // Actualizar orden
  await db
    .update(orders)
    .set({
      estimatedDeliveryTime: deliveryTime,
      estimatedTotalTime: totalTime,
      estimatedDelivery: estimatedArrival,
    })
    .where(eq(orders.id, orderId));

  return {
    prepTime: 0,
    deliveryTime,
    totalTime,
    buffer,
    estimatedArrival,
    distance: Math.round(distance * 10) / 10,
  };
}
