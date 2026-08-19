// Central Finance Service - Manages all financial data consistently
import { db } from "./db";
import {
  users,
  businesses,
  orders,
  wallets,
  transactions,
} from "@shared/schema-mysql";
import { eq, and, gte, sum, count, desc } from "drizzle-orm";
import { financialService } from "./unifiedFinancialService";

export interface FinancialMetrics {
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  todayOrders: number;
  todayRevenue: number;
  platformCommission: number;
  businessPayouts: number;
  driverPayouts: number;
  usersByRole: {
    customers: number;
    businesses: number;
    delivery: number;
    admins: number;
  };
  ordersByStatus: {
    pending: number;
    confirmed: number;
    preparing: number;
    on_the_way: number;
    delivered: number;
    cancelled: number;
  };
}

export class FinanceService {
  // Get comprehensive financial metrics
  static async getFinancialMetrics(): Promise<FinancialMetrics> {
    try {
      // Get all data in parallel
      const [allUsers, allOrders, allBusinesses] = await Promise.all([
        db.select().from(users),
        db.select().from(orders),
        db.select().from(businesses),
      ]);

      // Calculate today's date range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayOrders = allOrders.filter((order) => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= today;
      });

      // Calculate revenue metrics
      const completedOrders = allOrders.filter((o) => o.status === "delivered");
      const totalRevenue = completedOrders.reduce(
        (sum, order) => sum + (order.total || 0),
        0,
      );
      const todayRevenue = todayOrders
        .filter((o) => o.status === "delivered")
        .reduce((sum, order) => sum + (order.total || 0), 0);

      // Calcular comisiones usando el modelo real (15% markup sobre productos, 100% delivery al driver)
      let platformCommission = 0;
      let businessPayouts = 0;
      let driverPayouts = 0;

      for (const order of completedOrders) {
        const { platform, business, driver } =
          await financialService.calculateCommissions(
            order.total || 0,
            order.deliveryFee || 0,
          );
        platformCommission += platform;
        businessPayouts += business;
        driverPayouts += driver;
      }

      // Count users by role
      const usersByRole = {
        customers: allUsers.filter((u) => u.role === "customer").length,
        businesses: allUsers.filter((u) => u.role === "business_owner").length,
        delivery: allUsers.filter((u) => u.role === "delivery_driver").length,
        admins: allUsers.filter(
          (u) => u.role === "admin" || u.role === "super_admin",
        ).length,
      };

      // Count orders by status
      const ordersByStatus = {
        pending: allOrders.filter((o) => o.status === "pending").length,
        confirmed: allOrders.filter((o) => o.status === "confirmed").length,
        preparing: allOrders.filter((o) => o.status === "preparing").length,
        on_the_way: allOrders.filter((o) => o.status === "on_the_way").length,
        delivered: allOrders.filter((o) => o.status === "delivered").length,
        cancelled: allOrders.filter((o) => o.status === "cancelled").length,
      };

      return {
        totalUsers: allUsers.length,
        totalOrders: allOrders.length,
        // Importes en céntimos exactos: el cliente formatea (evita redondeos
        // que alteraban los importes, ej. 59,80 € -> 60 €)
        totalRevenue: totalRevenue,
        pendingOrders: ordersByStatus.pending,
        completedOrders: ordersByStatus.delivered,
        cancelledOrders: ordersByStatus.cancelled,
        todayOrders: todayOrders.length,
        todayRevenue: todayRevenue,
        platformCommission: platformCommission,
        businessPayouts: businessPayouts,
        driverPayouts: driverPayouts,
        usersByRole,
        ordersByStatus,
      };
    } catch (error) {
      console.error("Error calculating financial metrics:", error);
      throw error;
    }
  }

  // Get user-specific orders with consistent data
  static async getUserOrders(userId: string) {
    try {
      const userOrders = await db
        .select()
        .from(orders)
        .where(eq(orders.userId, userId))
        .orderBy(desc(orders.createdAt));

      return userOrders.map((order) => ({
        ...order,
        total: order.total || 0,
        subtotal: order.subtotal || 0,
        deliveryFee: order.deliveryFee || 0,
      }));
    } catch (error) {
      console.error("Error fetching user orders:", error);
      throw error;
    }
  }

  // Get business-specific metrics
  static async getBusinessMetrics(businessId: string) {
    try {
      const businessOrders = await db
        .select()
        .from(orders)
        .where(eq(orders.businessId, businessId));

      const completedOrders = businessOrders.filter(
        (o) => o.status === "delivered",
      );
      const totalRevenue = completedOrders.reduce(
        (sum, order) => sum + (order.total || 0),
        0,
      );
      let businessEarnings = 0;
      for (const order of completedOrders) {
        const { business } = await financialService.calculateCommissions(
          order.total || 0,
          order.deliveryFee || 0,
        );
        businessEarnings += business;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayOrders = businessOrders.filter((order) => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= today;
      });

      return {
        totalOrders: businessOrders.length,
        completedOrders: completedOrders.length,
        pendingOrders: businessOrders.filter((o) => o.status === "pending")
          .length,
        // Importes en céntimos exactos (sin redondeo de euros)
        totalRevenue: totalRevenue,
        businessEarnings: businessEarnings,
        todayOrders: todayOrders.length,
        averageOrderValue:
          completedOrders.length > 0
            ? Math.round(totalRevenue / completedOrders.length)
            : 0,
      };
    } catch (error) {
      console.error("Error calculating business metrics:", error);
      throw error;
    }
  }

  // Get driver-specific metrics
  static async getDriverMetrics(driverId: string) {
    try {
      const driverOrders = await db
        .select()
        .from(orders)
        .where(eq(orders.deliveryPersonId, driverId));

      const completedOrders = driverOrders.filter(
        (o) => o.status === "delivered",
      );
      const totalRevenue = completedOrders.reduce(
        (sum, order) => sum + (order.total || 0),
        0,
      );
      let driverEarnings = 0;
      for (const order of completedOrders) {
        const { driver } = await financialService.calculateCommissions(
          order.total || 0,
          order.deliveryFee || 0,
        );
        driverEarnings += driver;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayOrders = driverOrders.filter((order) => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= today && order.status === "delivered";
      });
      let todayEarnings = 0;
      for (const order of todayOrders) {
        const { driver } = await financialService.calculateCommissions(
          order.total || 0,
          order.deliveryFee || 0,
        );
        todayEarnings += driver;
      }

      return {
        totalDeliveries: completedOrders.length,
        // Importes en céntimos exactos (sin redondeo de euros)
        totalEarnings: driverEarnings,
        todayDeliveries: todayOrders.length,
        todayEarnings: todayEarnings,
        averageEarningsPerDelivery:
          completedOrders.length > 0
            ? Math.round(driverEarnings / completedOrders.length)
            : 0,
      };
    } catch (error) {
      console.error("Error calculating driver metrics:", error);
      throw error;
    }
  }

  // Sync order data to ensure consistency
  static async syncOrderData() {
    try {
      // Get all orders and recalculate totals
      const allOrders = await db.select().from(orders);

      for (const order of allOrders) {
        // Get order items
        const items = await db
          .select()
          .from(orderItems)
          .where(eq(orderItems.orderId, order.id));

        // Recalculate totals
        const subtotal = items.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0,
        );
        const deliveryFee = order.deliveryFee || 0;
        const tax = Math.round(subtotal * 0.08); // 8% tax
        const total = subtotal + deliveryFee + tax;

        // Update order with correct totals
        await db
          .update(orders)
          .set({
            subtotal,
            tax,
            total,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, order.id));
      }

      console.log("Order data synchronized successfully");
    } catch (error) {
      console.error("Error syncing order data:", error);
      throw error;
    }
  }
}
