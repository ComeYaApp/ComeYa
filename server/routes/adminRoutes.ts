import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { sql } from "drizzle-orm";

const router = express.Router();

// Dashboard metrics
router.get(
  "/dashboard/metrics",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { users, businesses, orders } = await import(
        "@shared/schema-mysql"
      );
      const { db } = await import("../db");

      const allUsers = await db.select().from(users);
      const allBusinesses = await db.select().from(businesses);
      const allOrders = await db.select().from(orders);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayOrders = allOrders.filter((o: any) => {
        const orderDate = new Date(o.createdAt);
        return orderDate >= today;
      });

      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentOrders = allOrders.filter((o: any) => {
        const orderDate = new Date(o.createdAt);
        return orderDate >= sevenDaysAgo;
      });

      const ordersToShow = todayOrders.length > 0 ? todayOrders : recentOrders;
      const timeframe = todayOrders.length > 0 ? "hoy" : "últimos 7 días";

      const cancelledToday = ordersToShow.filter(
        (o: any) => o.status === "cancelled",
      ).length;
      const driversOnline = allUsers.filter(
        (u: any) => u.role === "delivery_driver" && u.isActive,
      ).length;
      const totalDrivers = allUsers.filter(
        (u: any) => u.role === "delivery_driver",
      ).length;
      const pausedBusinesses = allBusinesses.filter(
        (b: any) => !b.isActive,
      ).length;
      const totalBusinesses = allBusinesses.length;

      const activeOrdersCount = allOrders.filter((o: any) =>
        ["pending", "accepted", "preparing", "ready", "on_the_way"].includes(
          o.status,
        ),
      ).length;

      const todayRevenue = ordersToShow
        .filter((o: any) => o.status === "delivered")
        .reduce((sum: number, o: any) => sum + Number(o.total), 0);

      res.json({
        activeOrders: activeOrdersCount,
        ordersToday: ordersToShow.length,
        onlineDrivers: driversOnline,
        todayOrders: ordersToShow.length,
        todayRevenue: todayRevenue,
        cancelledToday,
        cancellationRate:
          ordersToShow.length > 0
            ? ((cancelledToday / ordersToShow.length) * 100).toFixed(1) + "%"
            : "0%",
        avgDeliveryTime: 35,
        driversOnline,
        totalDrivers,
        pausedBusinesses,
        totalBusinesses,
        timeframe,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Get active orders for dashboard
router.get(
  "/dashboard/active-orders",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { orders, users, businesses } = await import(
        "@shared/schema-mysql"
      );
      const { db } = await import("../db");
      const { eq, inArray } = await import("drizzle-orm");

      const activeOrders = await db
        .select()
        .from(orders)
        .where(
          inArray(orders.status, [
            "pending",
            "accepted",
            "preparing",
            "ready",
            "on_the_way",
          ] as any),
        );

      const ordersWithDetails = [];

      for (const order of activeOrders) {
        const customer = await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(eq(users.id, order.userId as string))
          .limit(1);

        const business = await db
          .select({
            id: businesses.id,
            name: businesses.name,
            latitude: businesses.latitude,
            longitude: businesses.longitude,
          })
          .from(businesses)
          .where(eq(businesses.id, order.businessId as string))
          .limit(1);

        let driver = null;
        if (order.deliveryPersonId) {
          const driverData = await db
            .select({
              id: users.id,
              name: users.name,
              isOnline: users.isActive,
            })
            .from(users)
            .where(eq(users.id, order.deliveryPersonId as string))
            .limit(1);
          const { deliveryDrivers } = await import("@shared/schema-mysql");
          const [dd] = await db
            .select({ vehicleType: deliveryDrivers.vehicleType })
            .from(deliveryDrivers)
            .where(eq(deliveryDrivers.userId, order.deliveryPersonId as string))
            .limit(1);
          driver = driverData[0]
            ? { ...driverData[0], vehicleType: dd?.vehicleType ?? null }
            : null;
        }

        ordersWithDetails.push({
          id: order.id,
          status: order.status,
          total: order.total || 0,
          createdAt: order.createdAt,
          customer: customer[0] || { id: "", name: "Cliente" },
          business: business[0] || {
            id: "",
            name: "Negocio",
            latitude: null,
            longitude: null,
          },
          deliveryAddress: {
            latitude: order.deliveryLatitude,
            longitude: order.deliveryLongitude,
            address: order.deliveryAddress || "Dirección no disponible",
          },
          driver,
        });
      }

      res.json({ orders: ordersWithDetails });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Get online drivers for dashboard
router.get(
  "/dashboard/online-drivers",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { users, deliveryDrivers } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { eq } = await import("drizzle-orm");

      const driverUsers = await db
        .select()
        .from(users)
        .where(eq(users.role, "delivery_driver"));

      const driversWithDetails = await Promise.all(
        driverUsers.map(async (driver: any) => {
          const [dd] = await db
            .select()
            .from(deliveryDrivers)
            .where(eq(deliveryDrivers.userId, driver.id as string))
            .limit(1);
          return {
            id: driver.id,
            name: driver.name,
            isOnline: driver.isOnline ?? driver.isActive,
            lastActiveAt: driver.lastActiveAt,
            currentLatitude: dd?.currentLatitude ?? null,
            currentLongitude: dd?.currentLongitude ?? null,
            vehicleType: dd?.vehicleType ?? null,
            activeOrder: null,
          };
        }),
      );

      res.json({ drivers: driversWithDetails });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Get all users
router.get(
  "/users",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { users } = await import("@shared/schema-mysql");
      const { db } = await import("../db");

      const allUsers = await db.select().from(users);

      res.json({ success: true, users: allUsers });
    } catch (error: any) {
      console.error("Users endpoint error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// Update user
router.put(
  "/users/:id",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { users } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { eq } = await import("drizzle-orm");

      const { name, email, phone, role, isActive } = req.body;
      const userId = req.params.id as string;

      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email;
      if (phone !== undefined) updates.phone = phone;
      if (role !== undefined) updates.role = role;
      if (isActive !== undefined) updates.isActive = isActive;

      await db.update(users).set(updates).where(eq(users.id, userId));

      res.json({ success: true, message: "Usuario actualizado correctamente" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Get all orders
router.get(
  "/orders",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { orders, businesses, users } = await import(
        "@shared/schema-mysql"
      );
      const { db } = await import("../db");
      const { eq, desc, inArray } = await import("drizzle-orm");

      // Últimos 500 pedidos (antes traía TODOS y hacía 2 queries por pedido)
      const allOrders = await db
        .select()
        .from(orders)
        .orderBy(desc(orders.createdAt))
        .limit(500);

      // Enriquecido en lote: 1 query para negocios y 1 para clientes
      const businessIds = [
        ...new Set(allOrders.map((o) => o.businessId).filter(Boolean)),
      ] as string[];
      const userIds = [
        ...new Set(allOrders.map((o) => o.userId).filter(Boolean)),
      ] as string[];

      const businessRows = businessIds.length
        ? await db
            .select({ id: businesses.id, name: businesses.name })
            .from(businesses)
            .where(inArray(businesses.id, businessIds))
        : [];
      const userRows = userIds.length
        ? await db
            .select({ id: users.id, name: users.name, phone: users.phone })
            .from(users)
            .where(inArray(users.id, userIds))
        : [];

      const businessMap = new Map(businessRows.map((b) => [b.id, b.name]));
      const userMap = new Map(userRows.map((u) => [u.id, u]));

      const enrichedOrders = allOrders.map((order) => ({
        id: order.id,
        userId: order.userId,
        businessId: order.businessId,
        businessName:
          businessMap.get(order.businessId as string) ||
          order.businessName ||
          "Negocio",
        businessImage: order.businessImage,
        customerName: userMap.get(order.userId as string)?.name || "Cliente",
        customerPhone: userMap.get(order.userId as string)?.phone || "",
        status: order.status,
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        total: order.total,
        paymentMethod: order.paymentMethod,
        deliveryAddress: order.deliveryAddress,
        items: order.items,
        notes: order.notes,
        createdAt: order.createdAt,
        deliveredAt: order.deliveredAt,
        deliveryPersonId: order.deliveryPersonId,
      }));

      res.json({ success: true, orders: enrichedOrders });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Get business products
router.get(
  "/businesses/:id/products",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { products } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { eq } = await import("drizzle-orm");

      const businessProducts = await db
        .select()
        .from(products)
        .where(eq(products.businessId, req.params.id as any));

      res.json({ success: true, products: businessProducts });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Get all businesses
router.get(
  "/businesses",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { businesses } = await import("@shared/schema-mysql");
      const { db } = await import("../db");

      const allBusinesses = await db
        .select()
        .from(businesses)
        .orderBy(businesses.createdAt);

      res.json({ success: true, businesses: allBusinesses });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Update business custom commission
router.put(
  "/businesses/:id/commission",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { businesses } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { eq } = await import("drizzle-orm");
      const { customCommission } = req.body;

      const val =
        customCommission === null || customCommission === undefined
          ? null
          : parseInt(String(customCommission));

      if (val !== null && (isNaN(val) || val < 0 || val > 100)) {
        return res
          .status(400)
          .json({ success: false, error: "Comisión debe ser entre 0 y 100" });
      }

      await db
        .update(businesses)
        .set({ customCommission: val })
        .where(eq(businesses.id, req.params.id as any));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// Update business
router.put(
  "/businesses/:id",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { businesses } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { eq } = await import("drizzle-orm");
      const { name, address, phone, type, isActive, customCommission } =
        req.body;

      await db
        .update(businesses)
        .set({
          ...(name !== undefined && { name }),
          ...(address !== undefined && { address }),
          ...(phone !== undefined && { phone }),
          ...(type !== undefined && { type }),
          ...(isActive !== undefined && { isActive }),
          // null = usa comision global, numero = comision especifica
          ...(customCommission !== undefined && {
            customCommission:
              customCommission === null ? null : parseInt(customCommission),
          }),
        })
        .where(eq(businesses.id, req.params.id as any));

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// Zones
router.get(
  "/zones",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      res.json({ success: true, zones: [] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Delivery zones
router.get(
  "/delivery-zones",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { deliveryZones } = await import("@shared/schema-mysql");
      const { db } = await import("../db");

      const zones = await db.select().from(deliveryZones);

      res.json({
        success: true,
        zones: zones,
      });
    } catch (error: any) {
      console.error("Delivery zones error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// Drivers — lista completa con datos de delivery_drivers
router.get(
  "/drivers",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { users, deliveryDrivers, payouts } = await import(
        "@shared/schema-mysql"
      );
      const { db } = await import("../db");
      const { eq, and } = await import("drizzle-orm");

      const driverUsers = await db
        .select()
        .from(users)
        .where(eq(users.role, "delivery_driver"));

      const enriched = await Promise.all(
        driverUsers.map(async (u: any) => {
          const [dd] = await db
            .select()
            .from(deliveryDrivers)
            .where(eq(deliveryDrivers.userId, u.id as string))
            .limit(1);
          const pendingPays = await db
            .select()
            .from(payouts)
            .where(
              and(
                eq(payouts.recipientId, u.id as string),
                eq(payouts.status, "pending"),
              ),
            );
          const pendingAmount = pendingPays.reduce(
            (s: number, p: any) => s + Number(p.amount || 0),
            0,
          );
          return {
            id: u.id,
            name: u.name,
            email: u.email,
            phone: u.phone,
            isOnline: u.isOnline,
            isActive: u.isActive,
            isBlocked: dd?.isBlocked ?? false,
            blockedReason: dd?.blockedReason ?? null,
            strikes: dd?.strikes ?? 0,
            totalDeliveries: dd?.totalDeliveries ?? 0,
            rating: dd?.rating ?? null,
            vehicleType: dd?.vehicleType ?? null,
            vehiclePlate: dd?.vehiclePlate ?? null,
            currentLatitude: dd?.currentLatitude ?? null,
            currentLongitude: dd?.currentLongitude ?? null,
            createdAt: u.createdAt,
            lastActiveAt: u.lastActiveAt,
            pendingPayouts: pendingPays.length,
            pendingAmount,
          };
        }),
      );

      res.json({ success: true, drivers: enriched });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Block driver
router.post(
  "/drivers/:id/block",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { deliveryDrivers } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { eq } = await import("drizzle-orm");
      const { reason } = req.body;
      await db
        .update(deliveryDrivers)
        .set({
          isBlocked: true,
          blockedReason: reason ?? "Bloqueado por admin",
        })
        .where(eq(deliveryDrivers.userId, req.params.id as any));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Unblock driver
router.post(
  "/drivers/:id/unblock",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { deliveryDrivers } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { eq } = await import("drizzle-orm");
      await db
        .update(deliveryDrivers)
        .set({ isBlocked: false, blockedReason: null })
        .where(eq(deliveryDrivers.userId, req.params.id as any));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Add strike to driver
router.post(
  "/drivers/:id/strike",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { reason } = req.body;
      if (!reason?.trim())
        return res
          .status(400)
          .json({ error: "La razón del strike es requerida" });
      const { addStrike } = await import("../strikeService");
      await addStrike(req.params.id as string, reason.trim());
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Remove strike from driver
router.delete(
  "/drivers/:id/strike",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { removeStrike } = await import("../strikeService");
      await removeStrike(req.params.id as string);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Debug: Check database wallets (no auth for testing)
router.get("/debug/wallets-noauth", async (req, res) => {
  try {
    const { db } = await import("../db");

    const result = await db.execute(sql`
      SELECT 
        w.id, w.user_id, w.balance, w.pending_balance, w.total_earned, w.total_withdrawn,
        u.name, u.email, u.role, u.phone
      FROM wallets w 
      LEFT JOIN users u ON w.user_id = u.id 
      ORDER BY w.total_earned DESC
    `);

    res.json({ success: true, wallets: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Debug: Check database wallets
router.get(
  "/debug/wallets",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { db } = await import("../db");

      const result = await db.execute(sql`
      SELECT 
        w.id, w.userId, w.balance, w.pendingBalance, w.totalEarned, w.totalWithdrawn,
        u.name, u.email, u.role, u.phone
      FROM wallets w 
      LEFT JOIN users u ON w.userId = u.id 
      ORDER BY w.totalEarned DESC
    `);

      res.json({ success: true, wallets: result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Get all wallets (admin)
router.get(
  "/wallets",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { db } = await import("../db");

      const result = await db.execute(sql`
      SELECT 
        w.id, w.user_id as userId, w.balance, w.pending_balance as pendingBalance, 
        w.total_earned as totalEarned, w.total_withdrawn as totalWithdrawn,
        u.id as user_id, u.name as user_name, u.phone as user_phone, u.role as user_role
      FROM wallets w 
      LEFT JOIN users u ON w.user_id = u.id
    `);

      const rows = Array.isArray(result[0]) ? result[0] : result;
      const walletsWithUsers = rows.map((row: any) => ({
        id: row.id,
        userId: row.userId,
        balance: row.balance || 0,
        pendingBalance: row.pendingBalance || 0,
        totalEarned: row.totalEarned || 0,
        totalWithdrawn: row.totalWithdrawn || 0,
        user: row.user_name
          ? {
              id: row.user_id,
              name: row.user_name,
              phone: row.user_phone,
              role: row.user_role,
            }
          : null,
      }));

      res.json({ success: true, wallets: walletsWithUsers });
    } catch (error: any) {
      console.error("Wallets error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// Release pending balance (admin action)
router.post(
  "/wallets/:walletId/release",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { wallets } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { eq } = await import("drizzle-orm");

      const [wallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, req.params.walletId as any))
        .limit(1);

      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found" });
      }

      if (wallet.pendingBalance <= 0) {
        return res.status(400).json({ error: "No pending balance to release" });
      }

      await db
        .update(wallets)
        .set({
          balance: wallet.balance + wallet.pendingBalance,
          pendingBalance: 0,
        })
        .where(eq(wallets.id, req.params.walletId as any));

      res.json({ success: true, message: "Balance released successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Finance data
router.get(
  "/finance",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { transactions, users } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { eq, desc } = await import("drizzle-orm");

      const allTransactions = await db
        .select()
        .from(transactions)
        .orderBy(desc(transactions.createdAt));

      const enrichedTransactions = [];
      for (const transaction of allTransactions) {
        const user = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
          })
          .from(users)
          .where(eq(users.id, transaction.userId as string))
          .limit(1);

        enrichedTransactions.push({
          id: transaction.id,
          type: transaction.type,
          amount: transaction.amount,
          description: transaction.description,
          createdAt: transaction.createdAt,
          userId: transaction.userId,
          userName: user[0]?.name || "Usuario desconocido",
          userEmail: user[0]?.email || "",
          userRole: user[0]?.role || "",
        });
      }

      res.json({
        success: true,
        transactions: enrichedTransactions,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Coupons
router.get(
  "/coupons",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      res.json({ success: true, coupons: [] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Support tickets — tickets reales (incidencias y soporte)
router.get(
  "/support/tickets",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { supportTickets, users } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { desc, eq } = await import("drizzle-orm");

      const tickets = await db
        .select({
          id: supportTickets.id,
          userId: supportTickets.userId,
          orderId: supportTickets.orderId,
          subject: supportTickets.subject,
          category: supportTickets.category,
          priority: supportTickets.priority,
          status: supportTickets.status,
          createdAt: supportTickets.createdAt,
          userName: users.name,
          userPhone: users.phone,
        })
        .from(supportTickets)
        .leftJoin(users, eq(users.id, supportTickets.userId))
        .orderBy(desc(supportTickets.createdAt))
        .limit(200);

      res.json({ success: true, tickets });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Support tickets (alias)
router.get(
  "/support",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { supportTickets, users } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { desc, eq } = await import("drizzle-orm");

      const tickets = await db
        .select({
          id: supportTickets.id,
          userId: supportTickets.userId,
          orderId: supportTickets.orderId,
          subject: supportTickets.subject,
          category: supportTickets.category,
          priority: supportTickets.priority,
          status: supportTickets.status,
          createdAt: supportTickets.createdAt,
          userName: users.name,
          userPhone: users.phone,
        })
        .from(supportTickets)
        .leftJoin(users, eq(users.id, supportTickets.userId))
        .orderBy(desc(supportTickets.createdAt))
        .limit(200);

      res.json({ success: true, tickets });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Admin logs
router.get(
  "/logs",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { db } = await import("../db");

      const result = await db.execute(sql`
      SELECT 
        id,
        user_id as userId,
        action,
        entity_type as entityType,
        entity_id as entityId,
        changes,
        ip_address as ipAddress,
        user_agent as userAgent,
        created_at as createdAt
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 100
    `);

      const rows = Array.isArray(result[0]) ? result[0] : result;

      res.json({ success: true, logs: rows });
    } catch (error: any) {
      console.error("Admin logs error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// System settings
router.get(
  "/settings",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { systemSettings } = await import("@shared/schema-mysql");
      const { db } = await import("../db");

      const settings = await db.select().from(systemSettings);
      res.json({ success: true, settings });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Update system settings
router.put(
  "/settings",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { systemSettings } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { eq } = await import("drizzle-orm");

      const { key, value } = req.body;

      if (!key || value === undefined) {
        return res.status(400).json({ error: "Key and value are required" });
      }

      const [existing] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, key))
        .limit(1);

      if (existing) {
        await db
          .update(systemSettings)
          .set({ value: String(value), updatedBy: req.user!.id })
          .where(eq(systemSettings.key, key));
      } else {
        await db.insert(systemSettings).values({
          key,
          value: String(value),
          type: typeof value === "number" ? "number" : "string",
          category: "operations",
          updatedBy: req.user!.id,
        });
      }

      res.json({ success: true, message: "Setting updated successfully" });
    } catch (error: any) {
      console.error("Settings update error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

export default router;

// ── Verificación de repartidores y negocios ─────────────────────────────────

// GET /api/admin/verifications/pending — lista pendientes de aprobación
router.get(
  "/verifications/pending",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { users, deliveryDrivers, businesses } = await import(
        "@shared/schema-mysql"
      );
      const { db } = await import("../db");
      const { inArray, eq } = await import("drizzle-orm");

      const pending = await db
        .select()
        .from(users)
        .where(
          inArray(users.role, ["delivery_driver", "business_owner"] as any),
        );

      // Enriquecer con datos de delivery_drivers y businesses
      const enriched = await Promise.all(
        pending.map(async (user: any) => {
          let deliveryDriver = null;
          let business = null;

          if (user.role === "delivery_driver") {
            const [dd] = await db
              .select()
              .from(deliveryDrivers)
              .where(eq(deliveryDrivers.userId, user.id as string))
              .limit(1);
            deliveryDriver = dd || null;
          }

          if (user.role === "business_owner") {
            const [biz] = await db
              .select()
              .from(businesses)
              .where(eq(businesses.ownerId, user.id as string))
              .limit(1);
            business = biz || null;
          }

          return {
            ...user,
            deliveryDriver,
            business,
          };
        }),
      );

      res.json({ success: true, users: enriched });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// PUT /api/admin/verifications/:userId — aprobar o rechazar
router.put(
  "/verifications/:userId",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { users, auditLogs } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { eq } = await import("drizzle-orm");

      const { action, notes } = req.body; // action: "approve" | "reject"
      const userId = req.params.userId as string;

      if (!action || !["approve", "reject"].includes(action)) {
        return res
          .status(400)
          .json({ error: "action debe ser 'approve' o 'reject'" });
      }

      const verificationStatus = action === "approve" ? "verified" : "rejected";
      const isActive = action === "approve";

      // Antes de aprobar a un repartidor, validar que tenga los documentos
      // mínimos (DNI anverso + permiso de circulación + foto del vehículo)
      if (action === "approve") {
        const [targetUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        if (targetUser?.role === "delivery_driver") {
          const { deliveryDrivers } = await import("@shared/schema-mysql");
          const [dd] = await db
            .select()
            .from(deliveryDrivers)
            .where(eq(deliveryDrivers.userId, userId))
            .limit(1);
          const missing: string[] = [];
          if (!targetUser.idDocumentUrl)
            missing.push("DNI/NIE (anverso)");
          if (!(dd as any)?.vehicleLicensePhoto)
            missing.push("Permiso de circulación");
          if (!(dd as any)?.vehiclePhoto)
            missing.push("Foto del vehículo");
          if (missing.length > 0) {
            return res.status(400).json({
              error:
                "El repartidor no ha subido todos los documentos requeridos: " +
                missing.join(", "),
            });
          }
        }
      }

      await db
        .update(users)
        .set({
          verificationStatus,
          verificationNotes: notes || null,
          isActive,
        })
        .where(eq(users.id, userId));

      // Audit log
      await db.insert(auditLogs).values({
        userId: req.user!.id,
        action:
          action === "approve"
            ? "verify_user_approved"
            : "verify_user_rejected",
        entityType: "user",
        entityId: userId,
        changes: JSON.stringify({ verificationStatus, notes }),
      });

      // Push notification al usuario
      try {
        const { sendPushToUser } = await import("../enhancedPushService");
        await sendPushToUser(userId, {
          title:
            action === "approve"
              ? "✅ Cuenta verificada"
              : "❌ Verificación rechazada",
          body:
            action === "approve"
              ? "Tu cuenta ha sido verificada. Ya puedes usar ComeYa."
              : `Tu verificación fue rechazada. ${notes || "Contacta con soporte para más información."}`,
          data: { screen: "Profile" },
        });
      } catch {}

      res.json({ success: true, verificationStatus });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Admin profile stats
router.get(
  "/profile/stats",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { db } = await import("../db");
      const adminId = req.user!.id;

      const result = await db.execute(sql`
      SELECT
        COUNT(*) as totalActions,
        SUM(action LIKE 'verify%') as verificationsProcessed,
        SUM(entity_type = 'payout') as payoutsProcessed,
        SUM(entity_type = 'payment_proof') as proofsReviewed,
        MAX(created_at) as lastActionAt
      FROM audit_logs
      WHERE user_id = ${adminId}
    `);

      const rows = Array.isArray(result[0]) ? result[0] : result;
      const stats = (rows as any[])[0] || {};

      // Pending counts for quick access
      const pending = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM payment_proofs WHERE status = 'pending') as pendingProofs,
        (SELECT COUNT(*) FROM payouts WHERE status = 'pending') as pendingPayouts,
        (SELECT COUNT(*) FROM orders WHERE status IN ('pending','confirmed','preparing','on_the_way')) as activeOrders
    `);
      const pendingRows = Array.isArray(pending[0]) ? pending[0] : pending;
      const pendingData = (pendingRows as any[])[0] || {};

      res.json({
        success: true,
        stats: {
          totalActions: Number(stats.totalActions) || 0,
          verificationsProcessed: Number(stats.verificationsProcessed) || 0,
          payoutsProcessed: Number(stats.payoutsProcessed) || 0,
          proofsReviewed: Number(stats.proofsReviewed) || 0,
          lastActionAt: stats.lastActionAt || null,
        },
        pending: {
          proofs: Number(pendingData.pendingProofs) || 0,
          payouts: Number(pendingData.pendingPayouts) || 0,
          orders: Number(pendingData.activeOrders) || 0,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Bank account (placeholder)
router.get(
  "/bank-account",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      res.json({
        success: true,
        bankAccount: null,
        message: "No bank account configured",
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// ── Gift Cards admin ────────────────────────────────────────────────────────

// GET /api/admin/gift-cards/pending
router.get(
  "/gift-cards/pending",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { GiftCardService } = await import("../giftCardService");
      res.json(await GiftCardService.getPendingGiftCards());
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// POST /api/admin/gift-cards/:id/activate
router.post(
  "/gift-cards/:id/activate",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { GiftCardService } = await import("../giftCardService");
      res.json(
        await GiftCardService.activateGiftCard(
          req.params.id as string,
          req.user!.id,
        ),
      );
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// POST /api/admin/gift-cards/:id/reject
router.post(
  "/gift-cards/:id/reject",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { reason } = req.body;
      if (!reason)
        return res
          .status(400)
          .json({ success: false, error: "Razón requerida" });
      const { GiftCardService } = await import("../giftCardService");
      res.json(
        await GiftCardService.rejectGiftCard(
          req.params.id as string,
          req.user!.id,
          reason,
        ),
      );
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// ==========================================
// DELIVERY VERIFICATION ADMIN
// ==========================================

// GET /api/admin/delivery-verifications/pending - Lista de repartidores pendientes
router.get(
  "/delivery-verifications/pending",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { users, deliveryDrivers } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { eq, or, asc } = await import("drizzle-orm");

      // Obtener usuarios con rol delivery_driver que necesitan verificación
      const pendingDrivers = await db
        .select()
        .from(users)
        .where(
          or(
            eq(users.role, "delivery_driver"),
            eq(users.verificationStatus, "pending" as any),
          ),
        )
        .orderBy(asc(users.createdAt));

      // Enrich con datos de delivery_drivers
      const enriched = await Promise.all(
        pendingDrivers.map(async (user: any) => {
          const [dd] = await db
            .select()
            .from(deliveryDrivers)
            .where(eq(deliveryDrivers.userId, user.id as string))
            .limit(1);

          return {
            id: user.id,
            name: user.name,
            phone: user.phone,
            email: user.email,
            verificationStatus: user.verificationStatus,
            isActive: user.isActive,
            createdAt: user.createdAt,
            vehicleInfo: {
              vehicleType: dd?.vehicleType || null,
              vehiclePlate: dd?.vehiclePlate || null,
              vehicleBrand: dd?.vehicleBrand || null,
              vehicleModel: dd?.vehicleModel || null,
              vehicleColor: dd?.vehicleColor || null,
            },
            documents: {
              idDocumentUrl: !!user.idDocumentUrl,
              idDocumentBackUrl: !!(user as any).idDocumentBackUrl,
              autonomoDocumentUrl: !!user.autonomoDocumentUrl,
              vehiclePhoto: !!dd?.vehiclePhoto,
              vehiclePlatePhoto: !!dd?.vehiclePlatePhoto,
              vehicleItvPhoto: !!dd?.vehicleItvPhoto,
              vehicleInsurancePhoto: !!dd?.vehicleInsurancePhoto,
              vehicleLicensePhoto: !!dd?.vehicleLicensePhoto,
            },
          };
        }),
      );

      res.json({ success: true, drivers: enriched });
    } catch (error: any) {
      console.error("Error getting pending deliveries:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// GET /api/admin/delivery-verifications/:userId - Get specific delivery verification details
router.get(
  "/delivery-verifications/:userId",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { users, deliveryDrivers } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { eq } = await import("drizzle-orm");

      const userId = req.params.userId as string;

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      const [driver] = await db
        .select()
        .from(deliveryDrivers)
        .where(eq(deliveryDrivers.userId, user.id as string))
        .limit(1);

      res.json({
        success: true,
        driver: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          verificationStatus: user.verificationStatus,
          verificationNotes: (user as any).verificationNotes,
          isActive: user.isActive,
          createdAt: user.createdAt,
          vehicleInfo: {
            vehicleType: driver?.vehicleType || null,
            vehiclePlate: driver?.vehiclePlate || null,
            vehicleBrand: driver?.vehicleBrand || null,
            vehicleModel: driver?.vehicleModel || null,
            vehicleColor: driver?.vehicleColor || null,
            vehicleYear: driver?.vehicleYear || null,
          },
          documents: {
            idDocumentUrl: user.idDocumentUrl,
            idDocumentBackUrl: (user as any).idDocumentBackUrl,
            autonomoDocumentUrl: user.autonomoDocumentUrl,
            vehiclePhoto: driver?.vehiclePhoto || null,
            vehiclePlatePhoto: driver?.vehiclePlatePhoto || null,
            vehicleItvPhoto: driver?.vehicleItvPhoto || null,
            vehicleInsurancePhoto: driver?.vehicleInsurancePhoto || null,
            vehicleLicensePhoto: driver?.vehicleLicensePhoto || null,
          },
        },
      });
    } catch (error: any) {
      console.error("Error getting delivery details:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// POST /api/admin/delivery-verifications/:userId/approve - Aprobar repartidor
router.post(
  "/delivery-verifications/:userId/approve",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { users, auditLogs } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { eq } = await import("drizzle-orm");

      const userId = req.params.userId as string;
      const adminId = req.user!.id;

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      // Actualizar usuario
      await db
        .update(users)
        .set({
          verificationStatus: "verified" as any,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      // Log de auditoría
      await db.insert(auditLogs).values({
        id: crypto.randomUUID(),
        userId: adminId,
        action: "delivery_approved",
        entityType: "user",
        entityId: userId,
        changes: JSON.stringify({
          verificationStatus: "verified",
          isActive: true,
        }),
        createdAt: new Date(),
      } as any);

      // Notificar al repartidor
      try {
        const { deliveryNotificationService } = await import(
          "../deliveryNotificationService"
        );
        await deliveryNotificationService.notifyApproved(userId);
      } catch {
        /*silencioso*/
      }

      res.json({
        success: true,
        message: `Repartidor ${user.name} aprobado correctamente`,
      });
    } catch (error: any) {
      console.error("Error approving delivery:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// POST /api/admin/delivery-verifications/:userId/reject - Rechazar repartidor
router.post(
  "/delivery-verifications/:userId/reject",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { users, auditLogs } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { eq } = await import("drizzle-orm");

      const userId = req.params.userId as string;
      const adminId = req.user!.id;
      const { reason } = req.body;

      if (!reason?.trim()) {
        return res.status(400).json({ error: "Razón de rechazo requerida" });
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      // Actualizar usuario
      await db
        .update(users)
        .set({
          verificationStatus: "rejected" as any,
          verificationNotes: reason.trim(),
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      // Log de auditoría
      await db.insert(auditLogs).values({
        id: crypto.randomUUID(),
        userId: adminId,
        action: "delivery_rejected",
        entityType: "user",
        entityId: userId,
        changes: JSON.stringify({
          verificationStatus: "rejected",
          rejectionReason: reason.trim(),
        }),
        createdAt: new Date(),
      } as any);

      // Notificar al repartidor
      try {
        const { deliveryNotificationService } = await import(
          "../deliveryNotificationService"
        );
        await deliveryNotificationService.notifyRejected(userId, reason.trim());
      } catch {
        /*silencioso*/
      }

      res.json({
        success: true,
        message: `Repartidor ${user.name} rechazado`,
      });
    } catch (error: any) {
      console.error("Error rejecting delivery:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// POST /api/admin/delivery-verifications/:userId/reset - Reiniciar verificación del repartidor
router.post(
  "/delivery-verifications/:userId/reset",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { users } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { eq } = await import("drizzle-orm");

      const userId = req.params.userId as string;

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      // Reiniciar estado
      await db
        .update(users)
        .set({
          verificationStatus: "pending" as any,
          verificationNotes: null,
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      res.json({
        success: true,
        message:
          "Verificación reiniciada. El repartidor puede enviar documentos nuevamente.",
      });
    } catch (error: any) {
      console.error("Error resetting verification:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// GET /api/admin/delivery-verifications/stats - Stats de verificaciones
router.get(
  "/delivery-verifications/stats",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { users } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { eq, and } = await import("drizzle-orm");

      // Contar por estado
      const [pendingCount] = await db
        .select({ count: users.id })
        .from(users)
        .where(
          and(
            eq(users.role, "delivery_driver"),
            eq(users.verificationStatus, "pending" as any),
          ),
        );

      const [verifiedCount] = await db
        .select({ count: users.id })
        .from(users)
        .where(
          and(
            eq(users.role, "delivery_driver"),
            eq(users.verificationStatus, "verified" as any),
          ),
        );

      const [rejectedCount] = await db
        .select({ count: users.id })
        .from(users)
        .where(
          and(
            eq(users.role, "delivery_driver"),
            eq(users.verificationStatus, "rejected" as any),
          ),
        );

      const [activeDrivers] = await db
        .select({ count: users.id })
        .from(users)
        .where(
          and(eq(users.role, "delivery_driver"), eq(users.isActive, true)),
        );

      res.json({
        success: true,
        stats: {
          pending: Number(pendingCount?.count || 0),
          verified: Number(verifiedCount?.count || 0),
          rejected: Number(rejectedCount?.count || 0),
          active: Number(activeDrivers?.count || 0),
        },
      });
    } catch (error: any) {
      console.error("Error getting verification stats:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
