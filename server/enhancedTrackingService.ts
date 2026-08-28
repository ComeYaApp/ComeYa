import { db } from "./db";
import { orders, deliveryDrivers, proximityAlerts } from "@shared/schema-mysql";
import { eq, and } from "drizzle-orm";
import { sendPushToUser } from "./enhancedPushService";

interface Location {
  latitude: number;
  longitude: number;
}

// Caché corta de ETA por pedido (el cliente hace polling cada 30s)
const ETA_CACHE_TTL_MS = 60_000;
const etaCache = new Map<string, { at: number; minutes: number }>();

export class EnhancedTrackingService {
  // Calcular distancia entre dos puntos (Haversine)
  private static calculateDistance(loc1: Location, loc2: Location): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = this.toRad(loc2.latitude - loc1.latitude);
    const dLon = this.toRad(loc2.longitude - loc1.longitude);
    const lat1 = this.toRad(loc1.latitude);
    const lat2 = this.toRad(loc2.latitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // Actualizar ubicación del repartidor y verificar proximidad
  static async updateDriverLocation(
    driverId: string,
    latitude: number,
    longitude: number,
    heading?: number,
    speed?: number,
  ) {
    // Pipeline unificado: persistencia + websocket + alerts throttled
    const { handleDriverLocationUpdate } = await import("./trackingPipeline");
    const result = await handleDriverLocationUpdate(
      driverId,
      latitude,
      longitude,
      { heading, speed },
    );
    return {
      success: result.success,
      location: { latitude, longitude, heading, speed },
    };
  }

  // Verificar y enviar alertas de tiempo (5 min, 2 min)
  static async checkTimeAlerts(orderId: string, etaMinutes: number) {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order || !order.deliveryPersonId) return;

    const timeAlerts = [
      {
        type: "eta_5min",
        threshold: 5,
        message: "¡Tu pedido llega en 5 minutos!",
      },
      {
        type: "eta_2min",
        threshold: 2,
        message: "¡Tu pedido llega en 2 minutos!",
      },
    ];

    for (const alert of timeAlerts) {
      if (etaMinutes <= alert.threshold) {
        // Verificar si ya se envió
        const [existing] = await db
          .select()
          .from(proximityAlerts)
          .where(
            and(
              eq(proximityAlerts.orderId, orderId),
              eq(proximityAlerts.alertType, alert.type),
            ),
          )
          .limit(1);

        if (!existing) {
          await db.insert(proximityAlerts).values({
            orderId,
            driverId: order.deliveryPersonId,
            alertType: alert.type,
            distance: 0,
            destinationType: "customer",
            notificationSent: true,
          });

          await sendPushToUser(order.userId, {
            title: alert.message,
            body: `Pedido #${orderId.slice(-6)}`,
            data: { orderId, screen: "OrderTracking", type: alert.type },
          });
        }
      }
    }
  }

  // Obtener ubicación actual del repartidor
  static async getDriverLocation(orderId: string) {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order || !order.deliveryPersonId) {
      return { success: false, error: "Pedido sin repartidor asignado" };
    }

    const [driver] = await db
      .select()
      .from(deliveryDrivers)
      .where(eq(deliveryDrivers.userId, order.deliveryPersonId))
      .limit(1);

    if (!driver || !driver.currentLatitude || !driver.currentLongitude) {
      return {
        success: false,
        error: "Ubicación del repartidor no disponible",
      };
    }

    return {
      success: true,
      location: {
        latitude: driver.currentLatitude,
        longitude: driver.currentLongitude,
        lastUpdate: driver.lastLocationUpdate,
      },
    };
  }

  // Calcular ETA dinámico
  static async calculateDynamicETA(orderId: string) {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order || !order.deliveryPersonId) {
      return { success: false, eta: null };
    }

    const [driver] = await db
      .select()
      .from(deliveryDrivers)
      .where(eq(deliveryDrivers.userId, order.deliveryPersonId))
      .limit(1);

    if (
      !driver ||
      !driver.currentLatitude ||
      !driver.currentLongitude ||
      !order.deliveryLatitude ||
      !order.deliveryLongitude
    ) {
      return { success: false, eta: null };
    }

    const driverLocation: Location = {
      latitude: parseFloat(driver.currentLatitude),
      longitude: parseFloat(driver.currentLongitude),
    };

    const customerLocation: Location = {
      latitude: parseFloat(order.deliveryLatitude),
      longitude: parseFloat(order.deliveryLongitude),
    };

    const distance = this.calculateDistance(driverLocation, customerLocation);

    // ETA real con Google Directions (cacheado por el servicio) si el
    // repartidor va en camino y hay distancia relevante; si no, estimación
    let etaMinutes: number | null = null;
    const etaCacheKey = `eta:${orderId}`;
    const cachedETA = etaCache.get(etaCacheKey);
    if (cachedETA && Date.now() - cachedETA.at < ETA_CACHE_TTL_MS) {
      etaMinutes = cachedETA.minutes;
    } else if (
      ["picked_up", "on_the_way", "in_transit", "arriving"].includes(
        order.status,
      ) &&
      distance > 1
    ) {
      try {
        const { googleMapsService } = await import(
          "./services/googleMapsService"
        );
        const dirs = await googleMapsService.getDirections(
          driverLocation.latitude,
          driverLocation.longitude,
          customerLocation.latitude,
          customerLocation.longitude,
        );
        if (dirs?.duration?.value) {
          etaMinutes = Math.max(1, Math.ceil(dirs.duration.value / 60));
          etaCache.set(etaCacheKey, { at: Date.now(), minutes: etaMinutes });
        }
      } catch (e) {
        console.error("ETA directions fallback:", e);
      }
    }

    // Fallback: velocidad promedio de 25 km/h en ciudad (la misma que usa
    // el estimador de tarifas — antes había 25 y 30 según el servicio y el
    // ETA "saltaba" al cambiar de método)
    if (etaMinutes == null) {
      const avgSpeed = 25;
      etaMinutes = Math.ceil((distance / avgSpeed) * 60);
    }

    // El ETA devuelto es SOLO el tiempo de TRAYECTO del repartidor, sin
    // sumar +15/+20 min de golpe según el estado (antes el número saltaba
    // de 5 a 25 al pasar de estado). La preparación del negocio se muestra
    // aparte en el cliente ("El negocio prepara tu pedido").
    const totalETA = Math.max(1, etaMinutes);

    const etaDate = new Date(Date.now() + totalETA * 60 * 1000);

    // Verificar alertas de tiempo
    await this.checkTimeAlerts(orderId, totalETA);

    return {
      success: true,
      eta: {
        minutes: totalETA,
        timestamp: etaDate,
        distance: Math.round(distance * 1000), // en metros
        confidence: distance < 5 ? 95 : distance < 10 ? 85 : 75,
      },
    };
  }

  // Obtener hitos del pedido
  static async getOrderMilestones(orderId: string) {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      return { success: false, milestones: null };
    }

    return {
      success: true,
      milestones: {
        orderPlaced: order.createdAt,
        restaurantConfirmed: order.businessResponseAt,
        preparationStarted: order.businessResponseAt,
        driverAssigned: order.assignedAt,
        pickedUp: order.driverPickedUpAt,
        onTheWay: order.driverPickedUpAt,
        delivered: order.deliveredAt,
      },
    };
  }
}
