import { db } from "./db";
import { orders, users } from "../shared/schema-mysql";
import { eq, and, inArray } from "drizzle-orm";

interface Location {
  latitude: number;
  longitude: number;
}

interface DeliveryStop {
  orderId: number;
  location: Location;
  address: string;
  estimatedTime: number; // minutos
  priority: number; // 1-5, mayor = más urgente
}

interface OptimizedRoute {
  driverId: number;
  stops: DeliveryStop[];
  totalDistance: number; // km
  totalTime: number; // minutos
  sequence: number[]; // orden de IDs de pedidos
}

// Calcular distancia entre dos puntos (fórmula de Haversine)
function calculateDistance(loc1: Location, loc2: Location): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = toRad(loc2.latitude - loc1.latitude);
  const dLon = toRad(loc2.longitude - loc1.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(loc1.latitude)) *
      Math.cos(toRad(loc2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Algoritmo del vecino más cercano con prioridad
function nearestNeighborWithPriority(
  currentLocation: Location,
  remainingStops: DeliveryStop[],
): DeliveryStop | null {
  if (remainingStops.length === 0) return null;

  let bestStop = remainingStops[0];
  let bestScore = Infinity;

  for (const stop of remainingStops) {
    const distance = calculateDistance(currentLocation, stop.location);
    // Score = distancia / prioridad (menor score = mejor)
    const score = distance / stop.priority;

    if (score < bestScore) {
      bestScore = score;
      bestStop = stop;
    }
  }

  return bestStop;
}

export async function optimizeMultipleDeliveries(
  driverId: number,
  orderIds: number[],
): Promise<OptimizedRoute | null> {
  const { getSettingValue } = await import("./systemSettingsService");

  // Obtener ubicación actual del repartidor
  const [driver] = await db
    .select()
    .from(users)
    .where(eq(users.id, driverId))
    .limit(1);

  if (!driver || !driver.currentLatitude || !driver.currentLongitude) {
    return null;
  }

  const driverLocation: Location = {
    latitude: driver.currentLatitude,
    longitude: driver.currentLongitude,
  };

  // Obtener detalles de los pedidos
  const ordersList = await db
    .select()
    .from(orders)
    .where(inArray(orders.id, orderIds));

  if (ordersList.length === 0) {
    return null;
  }

  // Obtener configuraciones
  const averageSpeed = await getSettingValue("delivery_average_speed_kmh", 20);
  const stopTime = await getSettingValue("delivery_stop_time_minutes", 10);

  // Crear stops con prioridad basada en tiempo de espera
  const stops: DeliveryStop[] = ordersList.map((order) => {
    const waitTime = Date.now() - new Date(order.createdAt).getTime();
    const waitMinutes = waitTime / (1000 * 60);

    // Prioridad: 1-5, aumenta con tiempo de espera
    let priority = 1;
    if (waitMinutes > 30) priority = 5;
    else if (waitMinutes > 20) priority = 4;
    else if (waitMinutes > 15) priority = 3;
    else if (waitMinutes > 10) priority = 2;

    return {
      orderId: order.id,
      location: {
        latitude: order.deliveryLatitude || 0,
        longitude: order.deliveryLongitude || 0,
      },
      address: order.deliveryAddress || "",
      estimatedTime: stopTime,
      priority,
    };
  });

  // Optimizar ruta usando vecino más cercano con prioridad
  const optimizedStops: DeliveryStop[] = [];
  const remainingStops = [...stops];
  let currentLocation = driverLocation;
  let totalDistance = 0;
  let totalTime = 0;

  while (remainingStops.length > 0) {
    const nextStop = nearestNeighborWithPriority(
      currentLocation,
      remainingStops,
    );

    if (!nextStop) break;

    const distance = calculateDistance(currentLocation, nextStop.location);
    totalDistance += distance;

    // Tiempo = distancia / velocidad promedio + tiempo de entrega
    const travelTime = (distance / averageSpeed) * 60; // minutos
    totalTime += travelTime + nextStop.estimatedTime;

    optimizedStops.push(nextStop);
    currentLocation = nextStop.location;

    const index = remainingStops.findIndex(
      (s) => s.orderId === nextStop.orderId,
    );
    remainingStops.splice(index, 1);
  }

  return {
    driverId,
    stops: optimizedStops,
    totalDistance: Math.round(totalDistance * 100) / 100,
    totalTime: Math.round(totalTime),
    sequence: optimizedStops.map((s) => s.orderId),
  };
}

export async function canDriverHandleMoreOrders(
  driverId: number,
  maxOrders: number = 3,
): Promise<boolean> {
  const activeOrders = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.deliveryPersonId, driverId),
        inArray(orders.status, ["picked_up", "ready"]),
      ),
    );

  return activeOrders.length < maxOrders;
}

export async function estimateDeliveryTime(
  driverLocation: Location,
  deliveryLocation: Location,
): Promise<number> {
  const { getSettingValue } = await import("./systemSettingsService");
  const distance = calculateDistance(driverLocation, deliveryLocation);
  const averageSpeed = await getSettingValue("delivery_average_speed_kmh", 20); // km/h
  const deliveryTime = await getSettingValue("delivery_stop_time_minutes", 10); // minutos para entrega

  const travelTime = (distance / averageSpeed) * 60; // minutos
  return Math.round(travelTime + deliveryTime);
}

export async function getDriverCurrentRoute(
  driverId: number,
): Promise<OptimizedRoute | null> {
  const activeOrders = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.deliveryPersonId, driverId),
        inArray(orders.status, ["picked_up", "ready"]),
      ),
    );

  if (activeOrders.length === 0) {
    return null;
  }

  return optimizeMultipleDeliveries(
    driverId,
    activeOrders.map((o) => o.id),
  );
}
