import { Router } from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { db } from "../db";
import { orderRefFromId } from "../orderNumberService";
import {
  orders,
  businesses,
  deliveryDrivers,
  users,
} from "@shared/schema-mysql";
import { eq, and, inArray, isNull } from "drizzle-orm";
import { googleMapsService } from "../services/googleMapsService";
import { notifyDriverAssigned } from "../websocket";
import { sendPushToUser } from "../enhancedPushService";

const router = Router();

const MAX_ROUTE_ORDERS = 6;

interface RouteNode {
  id: string;
  kind: "start" | "pickup" | "drop";
  orderId?: string;
  lat: number;
  lng: number;
  label: string;
}

// ─── POST /api/driver/route/optimize ─────────────────────────────────────────
// Optimiza una ruta multi-pedido (pickups → deliveries) usando Distance Matrix
// de Google (cacheada) y nearest-neighbor respetando pickup antes que entrega.
router.post(
  "/route/optimize",
  authenticateToken,
  requireRole("delivery_driver"),
  async (req, res) => {
    try {
      const { orderIds } = req.body;
      if (!Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({ error: "orderIds requeridos" });
      }
      if (orderIds.length > MAX_ROUTE_ORDERS) {
        return res
          .status(400)
          .json({ error: `Máximo ${MAX_ROUTE_ORDERS} pedidos por ruta` });
      }

      const userId = (req as any).user.id;

      // Posición actual del repartidor (o centro de Soria si no hay fix)
      const [driver] = await db
        .select({
          lat: deliveryDrivers.currentLatitude,
          lng: deliveryDrivers.currentLongitude,
        })
        .from(deliveryDrivers)
        .where(eq(deliveryDrivers.userId, userId))
        .limit(1);
      const startLat = driver?.lat ? parseFloat(driver.lat) : 41.7636;
      const startLng = driver?.lng ? parseFloat(driver.lng) : -2.4677;

      // Pedidos: deben estar ready y sin repartidor
      const rows = await db
        .select({
          id: orders.id,
          businessName: orders.businessName,
          status: orders.status,
          items: orders.items,
          deliveryFee: orders.deliveryFee,
          total: orders.total,
          paymentMethod: orders.paymentMethod,
          deliveryAddress: orders.deliveryAddress,
          deliveryLatitude: orders.deliveryLatitude,
          deliveryLongitude: orders.deliveryLongitude,
          businessLatitude: businesses.latitude,
          businessLongitude: businesses.longitude,
          customerName: users.name,
        })
        .from(orders)
        .leftJoin(businesses, eq(businesses.id, orders.businessId))
        .leftJoin(users, eq(users.id, orders.userId))
        .where(
          and(
            inArray(orders.id, orderIds),
            eq(orders.status, "ready"),
            isNull(orders.deliveryPersonId),
          ),
        );

      if (rows.length !== orderIds.length) {
        return res.status(400).json({
          error: "Algunos pedidos ya no están disponibles (aceptados o entregados)",
        });
      }

      const nodes: RouteNode[] = [
        {
          id: "start",
          kind: "start",
          lat: startLat,
          lng: startLng,
          label: "Tu posición",
        },
      ];
      const pickups: RouteNode[] = [];
      const drops = new Map<string, RouteNode>();

      for (const r of rows) {
        if (
          !r.businessLatitude ||
          !r.businessLongitude ||
          !r.deliveryLatitude ||
          !r.deliveryLongitude
        ) {
          return res.status(400).json({
            error: `El pedido ${await orderRefFromId(r.id)} no tiene coordenadas completas`,
          });
        }
        pickups.push({
          id: `p_${r.id}`,
          kind: "pickup",
          orderId: r.id,
          lat: parseFloat(r.businessLatitude),
          lng: parseFloat(r.businessLongitude),
          label: `Recoger en ${r.businessName || "el negocio"}`,
        });
        drops.set(r.id, {
          id: `d_${r.id}`,
          kind: "drop",
          orderId: r.id,
          lat: parseFloat(r.deliveryLatitude),
          lng: parseFloat(r.deliveryLongitude),
          label: `Entregar a ${r.customerName || "cliente"}`,
        });
      }

      const all = [nodes[0], ...pickups, ...[...drops.values()]];
      const matrix = await googleMapsService.getDistanceMatrix(
        all.map((n) => ({ lat: n.lat, lng: n.lng })),
        all.map((n) => ({ lat: n.lat, lng: n.lng })),
      );
      const idx = new Map(all.map((n, i) => [n.id, i]));

      // Greedy nearest-neighbor respetando pickup → delivery de cada pedido
      const sequence: RouteNode[] = [];
      const visitedPickups = new Set<string>();
      const visitedDrops = new Set<string>();
      let current = nodes[0];

      while (visitedDrops.size < drops.size) {
        const candidates: RouteNode[] = [];
        for (const p of pickups) {
          if (!visitedPickups.has(p.orderId!)) candidates.push(p);
        }
        for (const [orderId, d] of drops) {
          if (visitedPickups.has(orderId) && !visitedDrops.has(orderId)) {
            candidates.push(d);
          }
        }
        if (!candidates.length) break;

        let best: RouteNode | null = null;
        let bestDuration = Infinity;
        const ci = idx.get(current.id)!;
        for (const c of candidates) {
          const di = idx.get(c.id)!;
          const cell = matrix[ci]?.[di];
          const dur = cell?.durationSeconds ?? Infinity;
          if (dur < bestDuration) {
            bestDuration = dur;
            best = c;
          }
        }
        if (!best) break;

        sequence.push(best);
        if (best.kind === "pickup") visitedPickups.add(best.orderId!);
        else visitedDrops.add(best.orderId!);
        current = best;
      }

      // Construir legs y totales
      const legs: any[] = [];
      let totalDistanceMeters = 0;
      let totalDurationSeconds = 0;
      const path = [nodes[0], ...sequence];
      for (let i = 1; i < path.length; i++) {
        const from = path[i - 1];
        const to = path[i];
        const cell = matrix[idx.get(from.id)!]?.[idx.get(to.id)!];
        const distanceMeters = cell?.distanceMeters ?? 0;
        const durationSeconds = cell?.durationSeconds ?? 0;
        totalDistanceMeters += distanceMeters;
        totalDurationSeconds += durationSeconds;
        legs.push({
          from: from.label,
          to: to.label,
          distanceMeters,
          durationMinutes: Math.max(1, Math.round(durationSeconds / 60)),
        });
      }

      const ordersMap = new Map<string, any>(
        rows.map((r: any) => [r.id, r]),
      );
      const totalEarnings = rows.reduce(
        (s: number, r: any) => s + (Number(r.deliveryFee) || 0),
        0,
      );

      res.json({
        success: true,
        route: {
          nodes: path.map((n) => ({
            ...n,
            orderId: n.orderId || undefined,
            fee: n.orderId ? Number(ordersMap.get(n.orderId)?.deliveryFee) || 0 : 0,
            paymentMethod: n.orderId
              ? ordersMap.get(n.orderId)?.paymentMethod
              : null,
            address:
              n.kind === "drop" && n.orderId
                ? ordersMap.get(n.orderId)?.deliveryAddress
                : undefined,
          })),
          legs,
          totalDistanceMeters,
          totalDistanceKm: (totalDistanceMeters / 1000).toFixed(1),
          totalDurationMinutes: Math.max(1, Math.round(totalDurationSeconds / 60)),
          totalEarnings,
        },
      });
    } catch (error: any) {
      console.error("route/optimize error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// ─── POST /api/driver/accept-route ───────────────────────────────────────────
// Acepta en bloque los pedidos de una ruta optimizada (todos reales).
router.post(
  "/accept-route",
  authenticateToken,
  requireRole("delivery_driver"),
  async (req, res) => {
    try {
      const { orderIds } = req.body;
      if (!Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({ error: "orderIds requeridos" });
      }
      if (orderIds.length > MAX_ROUTE_ORDERS) {
        return res
          .status(400)
          .json({ error: `Máximo ${MAX_ROUTE_ORDERS} pedidos por ruta` });
      }

      const userId = (req as any).user.id;
      const rows = await db
        .select({
          id: orders.id,
          userId: orders.userId,
          businessId: orders.businessId,
          status: orders.status,
          deliveryPersonId: orders.deliveryPersonId,
        })
        .from(orders)
        .where(inArray(orders.id, orderIds));

      const available = rows.filter(
        (r: any) => r.status === "ready" && !r.deliveryPersonId,
      );
      if (available.length !== orderIds.length) {
        return res.status(400).json({
          error: "Algunos pedidos ya no están disponibles",
        });
      }

      const assignedAt = new Date();
      for (const order of available) {
        await db
          .update(orders)
          .set({
            deliveryPersonId: userId,
            status: "assigned",
            assignedAt,
            updatedAt: assignedAt,
          })
          .where(eq(orders.id, order.id));

        notifyDriverAssigned(userId, {
          orderId: order.id,
          status: "assigned",
          assignedAt: assignedAt.toISOString(),
        });

        if (order.userId) {
          sendPushToUser(order.userId, {
            title: "🛵 Repartidor asignado",
            body: `Tu pedido ${await orderRefFromId(order.id)} está en camino al negocio`,
            data: { orderId: order.id, screen: "OrderTracking" },
          }).catch(() => {});
        }
      }

      res.json({
        success: true,
        assigned: available.map((o: any) => o.id),
        message: `${available.length} pedidos asignados a tu ruta`,
      });
    } catch (error: any) {
      console.error("accept-route error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

export default router;
