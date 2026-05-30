import { db } from "./db";
import { orders, deliveryDrivers, proximityAlerts } from "@shared/schema-mysql";
import { eq, and } from "drizzle-orm";
import { sendPushToUser } from "./enhancedPushService";

interface Location {
  latitude: number;
  longitude: number;
}

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
    // Actualizar ubicación del repartidor
    await db
      .update(deliveryDrivers)
      .set({
        currentLatitude: latitude.toString(),
        currentLongitude: longitude.toString(),
        lastLocationUpdate: new Date(),
      })
      .where(eq(deliveryDrivers.userId, driverId));

    // Buscar pedidos activos del repartidor
    const activeOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.deliveryPersonId, driverId),
          eq(orders.status, "on_the_way"),
        ),
      );

    // Verificar proximidad para cada pedido
    for (const order of activeOrders) {
      if (!order.deliveryLatitude || !order.deliveryLongitude) continue;

      const customerLocation: Location = {
        latitude: parseFloat(order.deliveryLatitude),
        longitude: parseFloat(order.deliveryLongitude),
      };

      const driverLocation: Location = { latitude, longitude };
      const distance = this.calculateDistance(driverLocation, customerLocation);
      const distanceMeters = distance * 1000;

      // Notificar si está cerca
      await this.checkProximityAlerts(
        order.id,
        order.userId,
        driverId,
        distanceMeters,
      );
    }

    return {
      success: true,
      location: { latitude, longitude, heading, speed },
    };
  }

  // Verificar y enviar alertas de proximidad
  private static async checkProximityAlerts(
    orderId: string,
    customerId: string,
    driverId: string,
    distanceMeters: number,
  ) {
    const alerts = [
      { type: "nearby", distance: 500, message: "Tu repartidor está a 500m" },
      {
        type: "approaching",
        distance: 200,
        message: "Tu repartidor está llegando (200m)",
      },
      { type: "arrived", distance: 50, message: "¡Tu repartidor ha llegado!" },
    ];

    for (const alert of alerts) {
      if (distanceMeters <= alert.distance) {
        // Verificar si ya se envió esta alerta
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
          // Crear alerta
          await db.insert(proximityAlerts).values({
            orderId,
            driverId,
            alertType: alert.type,
            distance: Math.round(distanceMeters),
            destinationType: "customer",
            notificationSent: true,
          });

          // Enviar notificación push
          await sendPushToUser(customerId, {
            title: alert.message,
            body: `Pedido #${orderId.slice(-6)}`,
            data: { orderId, screen: "OrderTracking", type: alert.type },
          });
        }
      }
    }
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

    // Velocidad promedio: 30 km/h en ciudad
    const avgSpeed = 30;
    const etaMinutes = Math.ceil((distance / avgSpeed) * 60);

    // Agregar tiempo de preparación si aún está en el negocio
    let totalETA = etaMinutes;
    if (order.status === "preparing") {
      totalETA += 15; // 15 min de preparación
    } else if (order.status === "accepted") {
      totalETA += 20; // 20 min de preparación + recogida
    }

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
