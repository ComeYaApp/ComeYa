import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { db } from "../db";
import {
  users,
  businesses,
  orders,
  deliveryDrivers,
} from "@shared/schema-mysql";
import { and, desc, eq, like, or, sql } from "drizzle-orm";

const router = express.Router();

function emptyGroups() {
  return {
    users: { hasMore: false, items: [] as any[] },
    businesses: { hasMore: false, items: [] as any[] },
    orders: { hasMore: false, items: [] as any[] },
    drivers: { hasMore: false, items: [] as any[] },
  };
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.warn("admin search group failed:", error);
    return fallback;
  }
}

// GET /api/admin/search?q=...&limit=5
// Búsqueda global para el panel: usuarios, negocios, pedidos y repartidores.
router.get(
  "/",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    const started = Date.now();
    const raw = String(req.query.q ?? "").trim();
    const limitRaw = Number.parseInt(String(req.query.limit ?? "5"), 10);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 10)
      : 5;

    if (raw.length < 2) {
      return res.json({
        success: true,
        q: raw,
        tookMs: Date.now() - started,
        groups: emptyGroups(),
      });
    }

    // Escapar comodines para que la búsqueda no se convierta en "%".
    const escaped = raw.replace(/[\\%_]/g, "\\$&");
    const contains = `%${escaped}%`;
    const prefix = `${escaped}%`;
    const orderQ = raw.replace(/^#/, "").replace(/^cy/i, "").trim();
    const orderPrefix = /^\d+$/.test(orderQ) ? `${orderQ}%` : null;

    const [usersGroup, businessesGroup, ordersGroup, driversGroup] =
      await Promise.all([
        safe(async () => {
          const rows = await db
            .select({
              id: users.id,
              name: users.name,
              phone: users.phone,
              email: users.email,
              role: users.role,
              dni: users.dni,
              isActive: users.isActive,
              verificationStatus: users.verificationStatus,
            })
            .from(users)
            .where(
              or(
                like(users.name, contains),
                like(users.email, contains),
                like(users.phone, prefix),
                like(users.dni, prefix),
              ),
            )
            .orderBy(users.name)
            .limit(limit + 1);
          return {
            hasMore: rows.length > limit,
            items: rows.slice(0, limit).map((u: any) => ({
              type: "user" as const,
              id: u.id,
              title: u.name || "Usuario",
              subtitle: [u.phone, u.email].filter(Boolean).join(" · "),
              badge: u.role,
              isActive: u.isActive,
              verificationStatus: u.verificationStatus,
            })),
          };
        }, emptyGroups().users),

        safe(async () => {
          const rows = await db
            .select({
              id: businesses.id,
              name: businesses.name,
              phone: businesses.phone,
              email: businesses.email,
              address: businesses.address,
              type: businesses.type,
              isActive: businesses.isActive,
              verificationStatus: businesses.verificationStatus,
              ownerName: users.name,
            })
            .from(businesses)
            .leftJoin(users, eq(businesses.ownerId, users.id))
            .where(
              or(
                like(businesses.name, contains),
                like(businesses.address, contains),
                like(users.name, contains),
                like(businesses.phone, prefix),
                like(businesses.email, prefix),
              ),
            )
            .orderBy(businesses.name)
            .limit(limit + 1);
          return {
            hasMore: rows.length > limit,
            items: rows.slice(0, limit).map((b: any) => ({
              type: "business" as const,
              id: b.id,
              title: b.name || "Negocio",
              subtitle: [b.ownerName, b.phone, b.address]
                .filter(Boolean)
                .join(" · "),
              badge: b.type,
              isActive: b.isActive,
              verificationStatus: b.verificationStatus,
            })),
          };
        }, emptyGroups().businesses),

        safe(async () => {
          const orderConditions = [
            orderPrefix
              ? like(sql`CAST(${orders.orderNumber} AS CHAR)`, orderPrefix)
              : undefined,
            like(orders.businessName, contains),
            like(users.name, contains),
            like(users.phone, prefix),
            like(orders.paymentReference, prefix),
          ].filter(Boolean) as any[];
          const rows = await db
            .select({
              id: orders.id,
              orderNumber: orders.orderNumber,
              businessName: orders.businessName,
              status: orders.status,
              total: orders.total,
              paymentMethod: orders.paymentMethod,
              paymentReference: orders.paymentReference,
              createdAt: orders.createdAt,
              customerName: users.name,
              customerPhone: users.phone,
            })
            .from(orders)
            .leftJoin(users, eq(orders.userId, users.id))
            .where(or(...orderConditions))
            .orderBy(desc(orders.createdAt))
            .limit(limit + 1);
          return {
            hasMore: rows.length > limit,
            items: rows.slice(0, limit).map((o: any) => ({
              type: "order" as const,
              id: o.id,
              title: `Pedido #${o.orderNumber ?? String(o.id).slice(-6)}`,
              subtitle: [o.customerName, o.businessName, o.status]
                .filter(Boolean)
                .join(" · "),
              badge: o.status,
              total: o.total,
              customerPhone: o.customerPhone,
            })),
          };
        }, emptyGroups().orders),

        safe(async () => {
          const rows = await db
            .select({
              id: users.id,
              name: users.name,
              phone: users.phone,
              email: users.email,
              isOnline: users.isOnline,
              isActive: users.isActive,
              verificationStatus: users.verificationStatus,
              vehicleType: deliveryDrivers.vehicleType,
              vehiclePlate: deliveryDrivers.vehiclePlate,
            })
            .from(users)
            .innerJoin(
              deliveryDrivers,
              eq(users.id, deliveryDrivers.userId),
            )
            .where(
              or(
                like(users.name, contains),
                like(users.email, contains),
                like(users.phone, prefix),
                like(deliveryDrivers.vehiclePlate, prefix),
              ),
            )
            .orderBy(users.name)
            .limit(limit + 1);
          return {
            hasMore: rows.length > limit,
            items: rows.slice(0, limit).map((d: any) => ({
              type: "driver" as const,
              id: d.id,
              title: d.name || "Repartidor",
              subtitle: [d.phone, d.vehicleType, d.vehiclePlate]
                .filter(Boolean)
                .join(" · "),
              badge: d.verificationStatus,
              isOnline: d.isOnline,
              isActive: d.isActive,
            })),
          };
        }, emptyGroups().drivers),
      ]);

    res.json({
      success: true,
      q: raw,
      tookMs: Date.now() - started,
      groups: {
        users: usersGroup,
        businesses: businessesGroup,
        orders: ordersGroup,
        drivers: driversGroup,
      },
    });
  },
);

export default router;
