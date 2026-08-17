// Plan Logística Local (B2B): los comercios solicitan un repartidor de la flota.
import { Router } from "express";
import { db } from "../db";
import { deliveryRequests, businesses } from "@shared/schema-mysql";
import { eq, and, isNull, desc } from "drizzle-orm";
import { authenticateToken, requireRole } from "../authMiddleware";
import { sendPushToUser } from "../enhancedPushService";
import crypto from "crypto";

const router = Router();

const FLAT_FEE = 350; // 3,50 € por entrega

// Crear solicitud de repartidor (negocio)
router.post(
  "/",
  authenticateToken,
  requireRole("business_owner", "admin", "super_admin"),
  async (req, res) => {
    try {
      const {
        businessId,
        pickupAddress,
        dropoffAddress,
        pickupLatitude,
        pickupLongitude,
        dropoffLatitude,
        dropoffLongitude,
        contactPhone,
        notes,
      } = req.body;

      if (!businessId || !pickupAddress || !dropoffAddress) {
        return res.status(400).json({
          error: "businessId, pickupAddress y dropoffAddress son requeridos",
        });
      }

      const [business] = await db
        .select()
        .from(businesses)
        .where(eq(businesses.id, businessId))
        .limit(1);
      if (!business) {
        return res.status(404).json({ error: "Negocio no encontrado" });
      }
      if (
        business.ownerId !== (req as any).user.id &&
        (req as any).user.role !== "admin" &&
        (req as any).user.role !== "super_admin"
      ) {
        return res.status(403).json({ error: "No autorizado" });
      }

      const id = crypto.randomUUID();
      await db.insert(deliveryRequests).values({
        id,
        businessId,
        businessName: business.name,
        pickupAddress,
        pickupLatitude: pickupLatitude || null,
        pickupLongitude: pickupLongitude || null,
        dropoffAddress,
        dropoffLatitude: dropoffLatitude || null,
        dropoffLongitude: dropoffLongitude || null,
        contactPhone: contactPhone || null,
        fee: FLAT_FEE,
        notes: notes || null,
        status: "pending",
      });

      // Avisar a repartidores disponibles
      try {
        const { DeliveryNotificationService } = await import(
          "../deliveryNotificationService"
        );
        await DeliveryNotificationService.broadcastToDrivers(
          "📦 Recogida para comercio",
          `${business.name} solicita un repartidor: ${pickupAddress} → ${dropoffAddress} (3,50 €)`,
          { screen: "DriverAvailable" },
        );
      } catch {}

      res.json({ success: true, requestId: id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Solicitudes aceptadas por el repartidor
router.get("/driver-mine", authenticateToken, async (req, res) => {
  try {
    const list = await db
      .select()
      .from(deliveryRequests)
      .where(eq(deliveryRequests.driverId, (req as any).user.id))
      .orderBy(desc(deliveryRequests.createdAt))
      .limit(50);
    res.json({ success: true, requests: list });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Solicitudes disponibles para repartidores
router.get("/available", authenticateToken, async (req, res) => {
  try {
    const list = await db
      .select()
      .from(deliveryRequests)
      .where(
        and(
          eq(deliveryRequests.status, "pending"),
          isNull(deliveryRequests.driverId),
        ),
      )
      .orderBy(desc(deliveryRequests.createdAt))
      .limit(50);
    res.json({ success: true, requests: list });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Mis solicitudes (negocio)
router.get("/mine", authenticateToken, async (req, res) => {
  try {
    const { businesses: bTable } = await import("@shared/schema-mysql");
    const ownerBusinesses = await db
      .select({ id: bTable.id })
      .from(bTable)
      .where(eq(bTable.ownerId, (req as any).user.id));
    const ids = ownerBusinesses.map((b) => b.id);
    if (!ids.length) return res.json({ success: true, requests: [] });

    const { inArray } = await import("drizzle-orm");
    const list = await db
      .select()
      .from(deliveryRequests)
      .where(inArray(deliveryRequests.businessId, ids))
      .orderBy(desc(deliveryRequests.createdAt))
      .limit(50);
    res.json({ success: true, requests: list });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Aceptar solicitud (repartidor)
router.post("/:id/accept", authenticateToken, async (req, res) => {
  try {
    const role = (req as any).user.role;
    if (role !== "delivery_driver" && role !== "admin") {
      return res.status(403).json({ error: "No autorizado" });
    }
    const [request] = await db
      .select()
      .from(deliveryRequests)
      .where(eq(deliveryRequests.id, req.params.id))
      .limit(1);
    if (!request) return res.status(404).json({ error: "Solicitud no encontrada" });
    if (request.status !== "pending" || request.driverId) {
      return res.status(400).json({ error: "Solicitud ya asignada" });
    }

    await db
      .update(deliveryRequests)
      .set({
        status: "accepted",
        driverId: (req as any).user.id,
        acceptedAt: new Date(),
      })
      .where(eq(deliveryRequests.id, req.params.id));

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Completar entrega (repartidor)
router.post("/:id/complete", authenticateToken, async (req, res) => {
  try {
    const [request] = await db
      .select()
      .from(deliveryRequests)
      .where(eq(deliveryRequests.id, req.params.id))
      .limit(1);
    if (!request) return res.status(404).json({ error: "Solicitud no encontrada" });
    if (request.driverId !== (req as any).user.id && (req as any).user.role !== "admin") {
      return res.status(403).json({ error: "No autorizado" });
    }

    await db
      .update(deliveryRequests)
      .set({ status: "delivered", deliveredAt: new Date() })
      .where(eq(deliveryRequests.id, req.params.id));

    // Abonar la tarifa plana al repartidor
    try {
      const { wallets, transactions } = await import("@shared/schema-mysql");
      const driverId = request.driverId;
      const [wallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, driverId))
        .limit(1);
      if (wallet) {
        await db
          .update(wallets)
          .set({
            balance: wallet.balance + request.fee,
            totalEarned: wallet.totalEarned + request.fee,
          })
          .where(eq(wallets.userId, driverId));
      }
      await db.insert(transactions).values({
        id: crypto.randomUUID(),
        userId: driverId,
        type: "logistics_delivery",
        amount: request.fee,
        status: "completed",
        description: `Entrega logística #${request.id.slice(-6)} (Logística Local)`,
      } as any);
      await sendPushToUser(driverId, {
        title: "✅ Entrega logística completada",
        body: `Ganaste ${(request.fee / 100).toFixed(2)} € por la entrega de ${request.businessName}`,
        data: { screen: "DriverEarnings" },
      });
    } catch (err) {
      console.error("Error paying logistics fee:", err);
    }

    res.json({ success: true, fee: request.fee });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
