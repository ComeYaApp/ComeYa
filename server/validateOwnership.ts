import { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { orders, businesses } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";

export async function validateBusinessOwnership(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { businessId } = req.params;
    const userId = req.user!.id;

    if (req.user!.role === "admin" || req.user!.role === "super_admin") {
      return next();
    }

    const [business] = await db
      .select({ ownerId: businesses.ownerId })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    if (business.ownerId !== userId) {
      return res.status(403).json({
        error: "You do not have permission to access this business",
      });
    }

    next();
  } catch (error) {
    console.error("Error validating business ownership:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function validateOrderBusinessOwnership(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const orderId = req.params.id || req.params.orderId;
    const userId = req.user!.id;

    if (req.user!.role === "admin" || req.user!.role === "super_admin") {
      return next();
    }

    const [order] = await db
      .select({ businessId: orders.businessId })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const ownerBusinesses = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.ownerId, userId));

    const businessIds = ownerBusinesses.map((b) => b.id);

    if (!businessIds.includes(order.businessId)) {
      return res.status(403).json({
        error: "This order does not belong to your business",
      });
    }

    next();
  } catch (error) {
    console.error("Error validating order business ownership:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function validateDriverOrderOwnership(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const orderId = req.params.id || req.params.orderId;
    const userId = req.user!.id;

    if (req.user!.role === "admin" || req.user!.role === "super_admin") {
      return next();
    }

    const [order] = await db
      .select({ deliveryPersonId: orders.deliveryPersonId })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.deliveryPersonId !== userId) {
      return res.status(403).json({
        error: "This order is not assigned to you",
      });
    }

    next();
  } catch (error) {
    console.error("Error validating driver order ownership:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function validateCustomerOrderOwnership(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const orderId = req.params.id || req.params.orderId;
    const userId = req.user!.id;
    const role = req.user!.role;

    if (role === "admin" || role === "super_admin") return next();

    const [order] = await db
      .select({
        userId: orders.userId,
        deliveryPersonId: orders.deliveryPersonId,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Allow: customer who owns it, business_owner (checked elsewhere)
    // El repartidor NO puede confirmar recepción — eso es exclusivo del cliente
    if (order.userId !== userId && role !== "business_owner") {
      return res.status(403).json({
        error: "Solo el cliente puede realizar esta acción",
      });
    }

    next();
  } catch (error) {
    console.error("Error validating customer order ownership:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
