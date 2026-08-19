import { Router, Request, Response } from "express";
import { db } from "./db";
import {
  orders,
  deliveryProofs,
  proximityAlerts,
  deliveryHeatmap,
  deliveryDrivers,
} from "../shared/schema-mysql";
import { eq, and, sql } from "drizzle-orm";
import { authenticateToken } from "./authMiddleware";
import { googleMapsService } from "./services/googleMapsService";

const router = Router();

// ─── Google Maps Directions Proxy (API key stays server-side) ───────────
router.get(
  "/directions",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { originLat, originLng, destLat, destLng } = req.query;
      
      if (!originLat || !originLng || !destLat || !destLng) {
        return res.status(400).json({ error: "Missing coordinates" });
      }

      const result = await googleMapsService.getDirections(
        parseFloat(originLat as string),
        parseFloat(originLng as string),
        parseFloat(destLat as string),
        parseFloat(destLng as string),
      );

      if (!result) {
        // Fallback: calcular distancia recta y estimar
        const distanceKm = googleMapsService.calculateHaversineDistance(
          parseFloat(originLat as string),
          parseFloat(originLng as string),
          parseFloat(destLat as string),
          parseFloat(destLng as string),
        );
        const estimatedMinutes = googleMapsService.estimateDeliveryTimeMinutes(distanceKm);
        
        return res.json({
          success: true,
          fallback: true,
          polyline: "",
          distance: { text: `${distanceKm.toFixed(1)} km`, value: Math.round(distanceKm * 1000) },
          duration: { text: `${estimatedMinutes} min`, value: estimatedMinutes * 60 },
          steps: [],
        });
      }

      res.json({
        success: true,
        polyline: result.polyline,
        distance: result.distance,
        duration: result.duration,
        steps: result.steps,
      });
    } catch (error: any) {
      console.error("Directions proxy error:", error);
      res.status(500).json({ error: "Failed to get directions" });
    }
  },
);

// Get Maps API usage stats (admin only)
router.get(
  "/maps-stats",
  authenticateToken,
  async (req: Request, res: Response) => {
    const userRole = (req as any).user?.role;
    if (userRole !== "admin" && userRole !== "super_admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }
    res.json({ success: true, ...googleMapsService.getUsageStats() });
  },
);

// Valida que el solicitante sea el repartidor asignado del pedido o un admin
async function requireAssignedDriver(
  req: Request,
  orderId: string,
): Promise<boolean> {
  const user = (req as any).user;
  if (!user?.id) return false;
  if (user.role === "admin" || user.role === "super_admin") return true;
  const [order] = await db
    .select({ deliveryPersonId: orders.deliveryPersonId })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  return !!order && order.deliveryPersonId === user.id;
}

// Geofence event (driver entered/exited geofence)
router.post(
  "/geofence-event",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { orderId, type, location, distance } = req.body;
      const userId = (req as any).user?.id;

      if (!(await requireAssignedDriver(req, orderId))) {
        return res
          .status(403)
          .json({ error: "No autorizado para este pedido" });
      }

      console.log(
        `📍 Geofence event: ${type} for order ${orderId} at ${location} (${distance}m)`,
      );

      // Update order with geofence event
      if (type === "enter" && location === "business") {
        await db
          .update(orders)
          .set({ driverPickedUpAt: new Date() })
          .where(eq(orders.id, orderId));
      } else if (type === "enter" && location === "customer") {
        await db
          .update(orders)
          .set({ driverArrivedAt: new Date() })
          .where(eq(orders.id, orderId));
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error handling geofence event:", error);
      res.status(500).json({ error: "Failed to process geofence event" });
    }
  },
);

// Proximity alert (driver approaching destination)
router.post(
  "/proximity-alert",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { orderId, type, distance, destinationType, timestamp } = req.body;
      const userId = (req as any).user?.id;

      if (!(await requireAssignedDriver(req, orderId))) {
        return res
          .status(403)
          .json({ error: "No autorizado para este pedido" });
      }

      console.log(
        `🔔 Proximity alert: ${type} for order ${orderId} (${distance}m from ${destinationType})`,
      );

      // Save proximity alert
      await db.insert(proximityAlerts).values({
        orderId,
        driverId: userId,
        alertType: type,
        distance,
        destinationType,
        notificationSent: true,
      });

      // Notificar al cliente cuando el repartidor está llegando
      try {
        const { sendPushToUser } = await import("./enhancedPushService");
        const [order] = await db
          .select({ userId: orders.userId })
          .from(orders)
          .where(eq(orders.id, orderId))
          .limit(1);
        if (order?.userId && distance <= 300) {
          await sendPushToUser(order.userId, {
            title: "🛵 Tu repartidor está cerca",
            body: `Llega en aproximadamente ${Math.max(1, Math.round(distance / 200))} minuto(s)`,
            data: { orderId, screen: "OrderTracking" },
          });
        }
      } catch (err) {
        console.error("Error sending proximity push:", err);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error handling proximity alert:", error);
      res.status(500).json({ error: "Failed to process proximity alert" });
    }
  },
);

// Submit delivery proof (photo + route)
router.post(
  "/proof/:orderId",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { orderId } = req.params;
      const { photoBase64, latitude, longitude, timestamp, accuracy, route } =
        req.body;
      const userId = (req as any).user?.id;

      if (!(await requireAssignedDriver(req, orderId))) {
        return res
          .status(403)
          .json({ error: "No autorizado para este pedido" });
      }

      console.log(`📸 Delivery proof submitted for order ${orderId}`);

      // Subir foto a Cloudinary (sin truncar base64)
      let photoUrl = "";
      try {
        const { CloudinaryService } = await import("./cloudinaryService");
        photoUrl = await CloudinaryService.uploadImage(
          photoBase64,
          "delivery-proofs",
          `proof-${orderId}-${Date.now()}`,
        );
      } catch (err) {
        console.error("Cloudinary upload failed for delivery proof:", err);
      }

      // Calculate route distance
      let routeDistance = 0;
      if (route && route.length > 1) {
        for (let i = 1; i < route.length; i++) {
          const prev = route[i - 1];
          const curr = route[i];
          routeDistance += calculateDistance(
            prev.latitude,
            prev.longitude,
            curr.latitude,
            curr.longitude,
          );
        }
      }

      // Save delivery proof
      await db.insert(deliveryProofs).values({
        orderId,
        driverId: userId,
        photoUrl,
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        accuracy,
        route: JSON.stringify(route),
        routeDistance: Math.round(routeDistance),
        timestamp: new Date(timestamp),
      });

      // Update order with proof data
      await db
        .update(orders)
        .set({
          deliveryProofPhoto: photoUrl,
          deliveryProofPhotoTimestamp: new Date(timestamp),
          deliveryRoute: JSON.stringify(route),
          deliveryDistance: Math.round(routeDistance),
          deliveryGpsAccuracy: accuracy,
          deliveryGpsValidated: accuracy ? accuracy < 50 : false,
        })
        .where(eq(orders.id, orderId));

      // Update driver stats
      await db
        .update(deliveryDrivers)
        .set({
          totalDistanceTraveled: sql`${deliveryDrivers.totalDistanceTraveled} + ${Math.round(routeDistance)}`,
        })
        .where(eq(deliveryDrivers.userId, userId));

      res.json({ success: true, routeDistance: Math.round(routeDistance) });
    } catch (error) {
      console.error("Error submitting delivery proof:", error);
      res.status(500).json({ error: "Failed to submit delivery proof" });
    }
  },
);

// Get delivery proof for order
router.get(
  "/proof/:orderId",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { orderId } = req.params;

      const proof = await db
        .select()
        .from(deliveryProofs)
        .where(eq(deliveryProofs.orderId, orderId))
        .limit(1);

      if (proof.length === 0) {
        return res.status(404).json({ error: "Delivery proof not found" });
      }

      res.json({ success: true, proof: proof[0] });
    } catch (error) {
      console.error("Error getting delivery proof:", error);
      res.status(500).json({ error: "Failed to get delivery proof" });
    }
  },
);

// Get heatmap data (admin only)
router.get(
  "/heatmap",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userRole = (req as any).user?.role;

      if (userRole !== "admin" && userRole !== "super_admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Get all completed orders with coordinates
      const completedOrders = await db
        .select({
          latitude: orders.deliveryLatitude,
          longitude: orders.deliveryLongitude,
          total: orders.total,
          deliveredAt: orders.deliveredAt,
        })
        .from(orders)
        .where(
          and(
            eq(orders.status, "delivered"),
            sql`${orders.deliveryLatitude} IS NOT NULL`,
            sql`${orders.deliveryLongitude} IS NOT NULL`,
          ),
        );

      // Group by grid cells (0.001 degree ~= 100m)
      const heatmapData: Record<
        string,
        {
          latitude: number;
          longitude: number;
          orderCount: number;
          totalRevenue: number;
        }
      > = {};

      completedOrders.forEach((order) => {
        if (!order.latitude || !order.longitude) return;

        const lat = parseFloat(order.latitude);
        const lng = parseFloat(order.longitude);

        // Round to grid cell
        const gridLat = Math.round(lat * 1000) / 1000;
        const gridLng = Math.round(lng * 1000) / 1000;
        const gridCell = `${gridLat},${gridLng}`;

        if (!heatmapData[gridCell]) {
          heatmapData[gridCell] = {
            latitude: gridLat,
            longitude: gridLng,
            orderCount: 0,
            totalRevenue: 0,
          };
        }

        heatmapData[gridCell].orderCount++;
        heatmapData[gridCell].totalRevenue += order.total || 0;
      });

      const heatmap = Object.values(heatmapData);

      res.json({ success: true, heatmap });
    } catch (error) {
      console.error("Error getting heatmap:", error);
      res.status(500).json({ error: "Failed to get heatmap data" });
    }
  },
);

// Generate tracking token for sharing
router.post(
  "/tracking-token/:orderId",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { orderId } = req.params;
      // authMiddleware asigna req.user.id (no userId); con userId siempre
      // salía undefined y el enlace público nunca se podía generar
      const userId = (req as any).user?.id ?? (req as any).user?.userId;

      // Verify user owns this order
      const order = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (order.length === 0 || order[0].userId !== userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Generate token (valid for 24 hours)
      const token = generateTrackingToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await db
        .update(orders)
        .set({
          trackingToken: token,
          trackingTokenExpires: expiresAt,
        })
        .where(eq(orders.id, orderId));

      const trackingUrl = `${process.env.FRONTEND_URL}/track/${token}`;

      res.json({ success: true, token, trackingUrl, expiresAt });
    } catch (error) {
      console.error("Error generating tracking token:", error);
      res.status(500).json({ error: "Failed to generate tracking token" });
    }
  },
);

// Public tracking endpoint (no auth required)
router.get("/track/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    // Find order by token
    const order = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.trackingToken, token),
          sql`${orders.trackingTokenExpires} > NOW()`,
        ),
      )
      .limit(1);

    if (order.length === 0) {
      return res
        .status(404)
        .json({ error: "Invalid or expired tracking link" });
    }

    // Get driver location if available
    let driverLocation = null;
    if (order[0].deliveryPersonId) {
      const driver = await db
        .select({
          latitude: deliveryDrivers.currentLatitude,
          longitude: deliveryDrivers.currentLongitude,
          lastUpdate: deliveryDrivers.lastLocationUpdate,
        })
        .from(deliveryDrivers)
        .where(eq(deliveryDrivers.userId, order[0].deliveryPersonId))
        .limit(1);

      if (driver.length > 0 && driver[0].latitude && driver[0].longitude) {
        driverLocation = {
          latitude: parseFloat(driver[0].latitude),
          longitude: parseFloat(driver[0].longitude),
          lastUpdate: driver[0].lastUpdate,
        };
      }
    }

    res.json({
      success: true,
      order: {
        id: order[0].id,
        status: order[0].status,
        businessName: order[0].businessName,
        estimatedDelivery: order[0].estimatedDelivery,
        deliveryAddress: order[0].deliveryAddress,
      },
      driverLocation,
    });
  } catch (error) {
    console.error("Error tracking order:", error);
    res.status(500).json({ error: "Failed to track order" });
  }
});

// Helper functions
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function generateTrackingToken(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

export default router;
