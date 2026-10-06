import { db } from "./db";
import {
  orders,
  businesses,
  deliveryDrivers,
  proximityAlerts,
} from "@shared/schema-mysql";
import { eq, and } from "drizzle-orm";
import { sendPushToUser } from "./enhancedPushService";
import { orderRef } from "./orderNumberService";

interface Location {
  latitude: number;
  longitude: number;
}

// Estados en los que el repartidor TODAVÍA no ha recogido: el ETA tiene que
// incluir su viaje al negocio, lo que le queda de preparación y el reparto.
const PRE_PICKUP_STATUSES = [
  "pending",
  "payment_failed",
  "accepted",
  "confirmed",
  "preparing",
  "ready",
  "assigned",
  "assigned_driver",
];
// Estados con el pedido ya en la mano del repartidor: solo queda el reparto.
const EN_ROUTE_STATUSES = [
  "picked_up",
  "on_the_way",
  "in_transit",
  "arriving",
];
// Preparación por defecto cuando el negocio no indicó una al aceptar.
const DEFAULT_PREP_MINUTES = 20;
// Velocidad media en ciudad cuando el proveedor de rutas no responde.
const AVG_CITY_SPEED_KMH = 25;
// A partir de esta distancia el viaje al negocio cuenta como trayecto real
// (por debajo, el repartidor ya está en la puerta). Con histéresis: no se
// vuelve a sumar hasta salir de AT_BUSINESS_OFF_KM para que el GPS parpadeando
// en el borde no añada y quite minutos alternativamente.
const AT_BUSINESS_KM = 0.15;
const AT_BUSINESS_OFF_KM = 0.35;
// Por pedido: si el repartidor estaba "en el negocio" en el último cálculo.
const atBusinessByOrder = new Map<string, boolean>();

// Caché corta de ETA por pedido y tramo. El cliente refresca cada 15 s y el
// pipeline emite cada 1 s: la clave incluye la posición redondeada a ~100 m
// para reutilizar el cálculo mientras el repartidor no se mueva de verdad.
const ETA_CACHE_TTL_MS = 60_000;
const etaCache = new Map<string, { at: number; minutes: number }>();

function locationKey(loc: Location): string {
  return `${loc.latitude.toFixed(3)},${loc.longitude.toFixed(3)}`;
}
// Último ETA publicado por pedido: amortiguador anti-picos (un ETA no puede
// subir de golpe +2 min/+20 % — el salto 15→25 era de aquí, al alternar entre
// ruta real y estimación por línea recta)
const lastEtaByOrder = new Map<string, number>();
// Último estado con el que se publicó el ETA: detecta el cambio de fase
// (p. ej. al recoger) para permitir una bajada mayor acotada una sola vez.
const lastStatusByOrder = new Map<string, string>();

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

    // Solo se avisa cuando el repartidor ya lleva el pedido: antes de eso el
    // ETA incluye el viaje al negocio y la preparación, así que un "llega en
    // 5 minutos" sería falso (era el aviso que llegaba al hacer el pedido).
    if (!EN_ROUTE_STATUSES.includes(order.status)) return;

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
            body: `Pedido ${orderRef(order)}`,
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

  /**
   * Minutos reales de ruta por calles entre dos puntos, con caché por tramo.
   * Si el proveedor de rutas falla, estima a velocidad media de ciudad.
   */
  private static async routeMinutes(
    cacheKey: string,
    from: Location,
    to: Location,
  ): Promise<number> {
    const cached = etaCache.get(cacheKey);
    if (cached && Date.now() - cached.at < ETA_CACHE_TTL_MS) {
      return cached.minutes;
    }

    let minutes: number | null = null;
    try {
      const { googleMapsService } = await import(
        "./services/googleMapsService"
      );
      const dirs = await googleMapsService.getDirections(
        from.latitude,
        from.longitude,
        to.latitude,
        to.longitude,
      );
      if (dirs?.duration?.value) {
        minutes = Math.max(1, Math.ceil(dirs.duration.value / 60));
      }
    } catch (e) {
      console.error("ETA directions fallback:", e);
    }

    if (minutes == null) {
      const km = this.calculateDistance(from, to);
      minutes = Math.max(1, Math.ceil((km / AVG_CITY_SPEED_KMH) * 60));
    }

    etaCache.set(cacheKey, { at: Date.now(), minutes });
    return minutes;
  }

  /**
   * Preparación que le queda al negocio. Se descuenta el tiempo ya
   * transcurrido desde que aceptó el pedido, y es 0 en cuanto lo marca
   * como listo (ahí solo falta que el repartidor llegue y reparta).
   */
  private static remainingPrepMinutes(order: any): number {
    if (["ready", "assigned", "assigned_driver"].includes(order.status)) {
      return 0;
    }
    const prep =
      Number(order.estimatedPrepMinutes) > 0
        ? Number(order.estimatedPrepMinutes)
        : DEFAULT_PREP_MINUTES;
    const since = order.businessResponseAt || order.createdAt;
    if (!since) return prep;
    const elapsedMin = (Date.now() - new Date(since).getTime()) / 60_000;
    return Math.max(0, Math.ceil(prep - elapsedMin));
  }

  // Calcular ETA dinámico
  static async calculateDynamicETA(orderId: string) {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      return { success: false, eta: null };
    }

    const enRoute = EN_ROUTE_STATUSES.includes(order.status);
    const prePickup = PRE_PICKUP_STATUSES.includes(order.status);
    if (!enRoute && !prePickup) {
      return { success: false, eta: null };
    }

    const customerLocation: Location | null =
      order.deliveryLatitude && order.deliveryLongitude
        ? {
            latitude: parseFloat(order.deliveryLatitude),
            longitude: parseFloat(order.deliveryLongitude),
          }
        : null;

    // Origen del tramo de reparto: el negocio (antes de recoger) o el
    // repartidor (una vez tiene el pedido).
    let businessLocation: Location | null = null;
    try {
      const [biz] = await db
        .select({
          latitude: businesses.latitude,
          longitude: businesses.longitude,
        })
        .from(businesses)
        .where(eq(businesses.id, order.businessId))
        .limit(1);
      const lat = parseFloat(biz?.latitude ?? "");
      const lng = parseFloat(biz?.longitude ?? "");
      if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
        businessLocation = { latitude: lat, longitude: lng };
      }
    } catch {
      /* sin coordenadas del negocio: se cae al tramo del repartidor */
    }

    let driverLocation: Location | null = null;
    if (order.deliveryPersonId) {
      const [driver] = await db
        .select()
        .from(deliveryDrivers)
        .where(eq(deliveryDrivers.userId, order.deliveryPersonId))
        .limit(1);
      const lat = parseFloat(driver?.currentLatitude ?? "");
      const lng = parseFloat(driver?.currentLongitude ?? "");
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        driverLocation = { latitude: lat, longitude: lng };
      }
    }

    let totalETA = 0;
    let prepRemaining = 0;
    let distanceMeters = 0;

    if (enRoute) {
      // Ya recogido: solo cuenta el tramo repartidor → cliente.
      if (!driverLocation || !customerLocation) {
        return { success: false, eta: null };
      }
      totalETA = await this.routeMinutes(
        `eta:${orderId}:d2c:${locationKey(driverLocation)}`,
        driverLocation,
        customerLocation,
      );
      distanceMeters = Math.round(
        this.calculateDistance(driverLocation, customerLocation) * 1000,
      );
    } else {
      // Aún sin recoger. El cliente tiene que ver el tiempo COMPLETO:
      // viaje del repartidor al negocio + lo que falta de preparación +
      // reparto hasta su casa. Antes solo se contaba el reparto y por eso
      // un pedido recién hecho anunciaba "5 minutos".
      prepRemaining = this.remainingPrepMinutes(order);

      let toBusiness = 0;
      if (driverLocation && businessLocation) {
        const km = this.calculateDistance(driverLocation, businessLocation);
        // Histéresis: se entra en "en el negocio" a 150 m y no se sale hasta
        // los 350 m, para no sumar/quitar el trayecto con el GPS parpadeando.
        const wasAtBusiness = atBusinessByOrder.get(orderId) ?? false;
        const isAtBusiness = wasAtBusiness
          ? km <= AT_BUSINESS_OFF_KM
          : km <= AT_BUSINESS_KM;
        atBusinessByOrder.set(orderId, isAtBusiness);
        if (!isAtBusiness) {
          toBusiness = await this.routeMinutes(
            `eta:${orderId}:d2b:${locationKey(driverLocation)}`,
            driverLocation,
            businessLocation,
          );
        }
      }

      let toCustomer = 0;
      if (customerLocation) {
        const origin = businessLocation || driverLocation;
        if (origin) {
          toCustomer = await this.routeMinutes(
            `eta:${orderId}:b2c:${locationKey(origin)}`,
            origin,
            customerLocation,
          );
          distanceMeters = Math.round(
            this.calculateDistance(origin, customerLocation) * 1000,
          );
        }
      }

      totalETA = toBusiness + prepRemaining + toCustomer;
      if (totalETA <= 0) {
        return { success: false, eta: null };
      }
    }

    totalETA = Math.max(1, totalETA);

    // Amortiguador anti-picos en ambas direcciones: frente al último valor
    // publicado, el ETA puede subir como mucho +2 min/+20 % y bajar como
    // mucho −3 min/−30 % (el tráfico real lo mueve poco a poco; lo que se
    // elimina es el salto seco por cambiar de método de cálculo o de fuente).
    // En un cambio de fase (p. ej. al recoger el pedido) se permite una única
    // bajada mayor acotada (−50 %) para que el nuevo estado se note sin que
    // el número rebote de vuelta.
    const lastEta = lastEtaByOrder.get(orderId);
    const lastStatus = lastStatusByOrder.get(orderId);
    const phaseChanged = lastStatus != null && lastStatus !== order.status;
    if (lastEta != null) {
      const maxRise = Math.max(2, Math.round(lastEta * 0.2));
      const maxDrop = phaseChanged
        ? Math.round(lastEta * 0.5)
        : Math.max(3, Math.round(lastEta * 0.3));
      totalETA = Math.min(
        Math.max(totalETA, lastEta - maxDrop),
        lastEta + maxRise,
      );
    }
    lastEtaByOrder.set(orderId, totalETA);
    lastStatusByOrder.set(orderId, order.status);
    if (["delivered", "completed", "cancelled"].includes(order.status)) {
      lastEtaByOrder.delete(orderId);
      lastStatusByOrder.delete(orderId);
      atBusinessByOrder.delete(orderId);
      etaCache.delete(`eta:${orderId}:d2c:${locationKey(driverLocation || { latitude: 0, longitude: 0 })}`);
    }

    const etaDate = new Date(Date.now() + totalETA * 60 * 1000);

    // Verificar alertas de tiempo (solo cuentan si ya va en camino)
    await this.checkTimeAlerts(orderId, totalETA);

    return {
      success: true,
      eta: {
        minutes: totalETA,
        timestamp: etaDate,
        distance: distanceMeters, // en metros
        confidence: distanceMeters < 5000 ? 95 : distanceMeters < 10000 ? 85 : 75,
        // Tramo que domina ahora mismo — el cliente lo usa para explicar
        // por qué el pedido tarda lo que tarda.
        phase: enRoute ? "to_customer" : "to_business",
        prepMinutes: prepRemaining,
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
