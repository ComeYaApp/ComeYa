import { db } from "./db";
import {
  orders,
  deliveryDrivers,
  proximityAlerts,
  businesses,
} from "@shared/schema-mysql";
import { eq, and, inArray } from "drizzle-orm";
import { sendPushToUser } from "./enhancedPushService";
import { getIO } from "./websocket";
import { evaluateDriverFix } from "./utils/locationFilter";

// ─── Configuración ────────────────────────────────────────────────────────────
const CHECK_INTERVAL_MS = 30_000; // checks caros (proximity/ETA/geofence) por pedido
const EMIT_INTERVAL_MS = 2_000; // emisión websocket por pedido
const PICKUP_RADIUS_M = 200; // radio del local para "repartidor en el negocio"
const ARRIVED_RADIUS_M = 200; // radio del cliente para marcar llegada

const lastCheckAt = new Map<string, number>();
const lastEmitAt = new Map<string, number>();

// ─── Utilidades ──────────────────────────────────────────────────────────────
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Alertas de proximidad al cliente (500/200/50 m) ─────────────────────────
const PROXIMITY_ALERTS = [
  {
    type: "nearby",
    distance: 500,
    title: "Tu repartidor está a 500m",
    body: "Tu pedido está muy cerca",
  },
  {
    type: "approaching",
    distance: 200,
    title: "Tu repartidor está llegando (200m)",
    body: "Prepárate para recibir tu pedido",
  },
  {
    type: "arrived",
    distance: 50,
    title: "¡Tu repartidor ha llegado!",
    body: "Tu pedido está siendo entregado",
  },
] as const;

async function checkProximityAlerts(
  order: any,
  driverId: string,
  distanceMeters: number,
) {
  for (const alert of PROXIMITY_ALERTS) {
    if (distanceMeters > alert.distance) continue;

    const [existing] = await db
      .select()
      .from(proximityAlerts)
      .where(
        and(
          eq(proximityAlerts.orderId, order.id),
          eq(proximityAlerts.alertType, alert.type),
        ),
      )
      .limit(1);

    if (!existing) {
      await db.insert(proximityAlerts).values({
        orderId: order.id,
        driverId,
        alertType: alert.type,
        distance: Math.round(distanceMeters),
        destinationType: "customer",
        notificationSent: true,
      });

      await sendPushToUser(order.userId, {
        title: alert.title,
        body: `${alert.body} · Pedido #${order.id.slice(-6)}`,
        data: { orderId: order.id, screen: "OrderTracking", type: alert.type },
      }).catch(() => {});
    }
  }
}

// ─── Geofences de servidor (local y cliente) ─────────────────────────────────
async function checkGeofenceMarkers(
  order: any,
  driverLat: number,
  driverLng: number,
  distanceToCustomerMeters: number,
) {
  // Llegada al local (estado previo a recogida)
  if (["accepted", "preparing", "ready"].includes(order.status)) {
    const [biz] = await db
      .select({
        latitude: businesses.latitude,
        longitude: businesses.longitude,
        ownerId: businesses.ownerId,
        name: businesses.name,
      })
      .from(businesses)
      .where(eq(businesses.id, order.businessId))
      .limit(1);

    if (biz?.latitude && biz?.longitude) {
      const d = haversineMeters(
        driverLat,
        driverLng,
        parseFloat(biz.latitude),
        parseFloat(biz.longitude),
      );

      if (d <= PICKUP_RADIUS_M) {
        const [existing] = await db
          .select()
          .from(proximityAlerts)
          .where(
            and(
              eq(proximityAlerts.orderId, order.id),
              eq(proximityAlerts.destinationType, "business"),
              eq(proximityAlerts.alertType, "arrived"),
            ),
          )
          .limit(1);

        if (!existing && biz.ownerId) {
          await db.insert(proximityAlerts).values({
            orderId: order.id,
            driverId: order.deliveryPersonId,
            alertType: "arrived",
            distance: Math.round(d),
            destinationType: "business",
            notificationSent: true,
          });

          await sendPushToUser(biz.ownerId, {
            title: "🏪 El repartidor llegó a tu local",
            body: `Pedido #${order.id.slice(-6)} · ${biz.name}`,
            data: { orderId: order.id, screen: "BusinessOrders", type: "driver_arrived" },
          }).catch(() => {});
        }
      }
    }
  }

  // Llegada al cliente (marca el hito en la orden)
  if (
    ["picked_up", "on_the_way", "in_transit"].includes(order.status) &&
    !order.driverArrivedAt &&
    distanceToCustomerMeters <= ARRIVED_RADIUS_M
  ) {
    await db
      .update(orders)
      .set({ driverArrivedAt: new Date() })
      .where(eq(orders.id, order.id));
  }
}

// ─── Checks caros con throttle ───────────────────────────────────────────────
async function runOrderChecks(
  order: any,
  driverLat: number,
  driverLng: number,
) {
  if (!order.deliveryLatitude || !order.deliveryLongitude) return;

  const distanceToCustomer = haversineMeters(
    driverLat,
    driverLng,
    parseFloat(order.deliveryLatitude),
    parseFloat(order.deliveryLongitude),
  );

  // Alertas de proximidad al cliente
  await checkProximityAlerts(order, order.deliveryPersonId, distanceToCustomer);

  // Alertas de tiempo + arriving (recalcula ETA y avisa a 5/2 min)
  try {
    const { EnhancedTrackingService } = await import("./enhancedTrackingService");
    await EnhancedTrackingService.calculateDynamicETA(order.id);
    const { checkAndUpdateArrivingStatus } = await import(
      "./arrivingStatusService"
    );
    await checkAndUpdateArrivingStatus(order.id, driverLat, driverLng);
  } catch (e) {
    console.error("trackingPipeline checks error:", e);
  }

  // Geofences de servidor
  await checkGeofenceMarkers(order, driverLat, driverLng, distanceToCustomer);
}

// ─── Punto de entrada único de ubicación del repartidor ──────────────────────
// Estado para el filtro anti-teletransporte (precisión, saltos imposibles y
// fixes fuera de orden que hacían "teletransportar" el marcador)
const driverFixStates = new Map<string, import("./utils/locationFilter").DriverFixState>();

export async function handleDriverLocationUpdate(
  userId: string,
  rawLatitude: number,
  rawLongitude: number,
  extra?: { heading?: number; speed?: number; accuracy?: number; timestamp?: number },
) {
  // Filtro anti-salto: coordenadas no finitas, precisión baja, fixes
  // desordenados (cola offline) y saltos a velocidad imposible nunca llegan
  // ni a la BD ni al websocket (romperían los mapas de los clientes)
  const verdict = evaluateDriverFix(driverFixStates, userId, rawLatitude, rawLongitude, {
    accuracy: extra?.accuracy,
    timestamp: extra?.timestamp,
  });
  if (!verdict.accept) {
    return { success: false, error: `Posición descartada (${verdict.reason})` };
  }
  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);

  // 1. Persistir ubicación
  await db
    .update(deliveryDrivers)
    .set({
      currentLatitude: latitude.toString(),
      currentLongitude: longitude.toString(),
      lastLocationUpdate: new Date(),
    })
    .where(eq(deliveryDrivers.userId, userId));

  // 2. Pedidos activos del repartidor
  const activeOrders = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.deliveryPersonId, userId),
        inArray(orders.status, [
          "accepted",
          "preparing",
          "ready",
          "picked_up",
          "on_the_way",
          "in_transit",
          "arriving",
        ]),
      ),
    );

  const now = Date.now();

  for (const order of activeOrders) {
    // Emisión websocket (throttle 2s por pedido)
    const lastEmit = lastEmitAt.get(order.id) ?? 0;
    if (now - lastEmit >= EMIT_INTERVAL_MS) {
      lastEmitAt.set(order.id, now);
      const payload = {
        orderId: order.id,
        driverId: userId,
        businessId: order.businessId,
        status: order.status,
        latitude,
        longitude,
        heading: extra?.heading ?? null,
        speed: extra?.speed ?? null,
        lastUpdate: new Date().toISOString(),
      };
      try {
        const io = getIO();
        io.to(`order:${order.id}`).emit("driver_location", payload);
        io.to(`business:${order.businessId}`).emit("driver_location", payload);
        // El centro de operaciones del admin ve todo el movimiento en vivo
        io.to("admins").emit("driver_location", payload);
      } catch {
        // socket.io no inicializado (tests) — ignorar
      }
    }

    // Checks caros (throttle 30s por pedido)
    const lastCheck = lastCheckAt.get(order.id) ?? 0;
    if (now - lastCheck < CHECK_INTERVAL_MS) continue;
    lastCheckAt.set(order.id, now);

    try {
      await runOrderChecks(order, latitude, longitude);
    } catch (e) {
      console.error(`trackingPipeline error for order ${order.id}:`, e);
    }
  }

  return { success: true, activeOrders: activeOrders.length };
}
