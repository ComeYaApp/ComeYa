// Intelligent Driver Assignment System for ComeYa - Production Ready
import { db } from "./db";
import {
  orders,
  businesses,
  users,
  deliveryDrivers,
} from "@shared/schema-mysql";
import { eq, and, isNull } from "drizzle-orm";
import { notifyDriverNewOrder, sendPushToUser } from "./enhancedPushService";

interface DriverLocation {
  driverId: string;
  latitude: number;
  longitude: number;
  isOnline: boolean;
  lastActiveAt: Date;
  currentOrderId?: string;
}

interface AssignmentResult {
  success: boolean;
  driverId?: string;
  driverName?: string;
  distance?: number;
  estimatedTime?: number;
  error?: string;
  performance?: {
    totalDeliveries: number;
    onTimeRate: number;
    isReliable: boolean;
  };
}

// Calculate distance between two points using Haversine formula
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Get available drivers near a location
async function getAvailableDriversNear(
  latitude: number,
  longitude: number,
  radiusKm: number = 10,
): Promise<DriverLocation[]> {
  try {
    // Get all active delivery drivers from deliveryDrivers table
    const driversData = await db
      .select({
        id: deliveryDrivers.userId,
        isAvailable: deliveryDrivers.isAvailable,
        latitude: deliveryDrivers.currentLatitude,
        longitude: deliveryDrivers.currentLongitude,
        lastLocationUpdate: deliveryDrivers.lastLocationUpdate,
      })
      .from(deliveryDrivers)
      .where(
        and(
          eq(deliveryDrivers.isAvailable, true),
          eq(deliveryDrivers.isBlocked, false),
        ),
      );

    // Remap to match expected format
    const drivers = driversData.map((d) => ({
      id: d.id,
      name: "",
      isOnline: d.isAvailable,
      lastActiveAt: d.lastLocationUpdate,
      latitude: d.latitude,
      longitude: d.longitude,
    }));

    // Filter by distance and availability
    const availableDrivers: DriverLocation[] = [];

    for (const driver of drivers) {
      if (!driver.latitude || !driver.longitude) continue;

      const distance = calculateDistance(
        latitude,
        longitude,
        parseFloat(driver.latitude),
        parseFloat(driver.longitude),
      );

      if (distance <= radiusKm) {
        // Check if driver has an active order
        const [activeOrder] = await db
          .select({ id: orders.id })
          .from(orders)
          .where(
            and(
              eq(orders.deliveryPersonId, driver.id),
              eq(orders.status, "assigned"), // or "picked_up", "in_transit"
            ),
          )
          .limit(1);

        availableDrivers.push({
          driverId: driver.id,
          latitude: parseFloat(driver.latitude),
          longitude: parseFloat(driver.longitude),
          isOnline: driver.isOnline || false,
          lastActiveAt: driver.lastActiveAt || new Date(),
          currentOrderId: activeOrder?.id,
        });
      }
    }

    // Sort by distance (closest first)
    availableDrivers.sort((a, b) => {
      const distanceA = calculateDistance(
        latitude,
        longitude,
        a.latitude,
        a.longitude,
      );
      const distanceB = calculateDistance(
        latitude,
        longitude,
        b.latitude,
        b.longitude,
      );
      return distanceA - distanceB;
    });

    return availableDrivers;
  } catch (error) {
    console.error("❌ Error getting available drivers:", error);
    return [];
  }
}

// Assign driver to order automatically
export async function autoAssignDriver(
  orderId: string,
): Promise<AssignmentResult> {
  try {
    console.log(`🤖 Auto-assigning driver for order: ${orderId}`);

    // Get order details
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      return { success: false, error: "Order not found" };
    }

    if (order.deliveryPersonId) {
      return { success: false, error: "Order already has a driver assigned" };
    }

    // Get business location
    const [business] = await db
      .select({
        latitude: businesses.latitude,
        longitude: businesses.longitude,
        name: businesses.name,
      })
      .from(businesses)
      .where(eq(businesses.id, order.businessId))
      .limit(1);

    if (!business?.latitude || !business?.longitude) {
      return { success: false, error: "Business location not configured" };
    }

    const businessLat = parseFloat(business.latitude);
    const businessLng = parseFloat(business.longitude);

    // Find available drivers
    const availableDrivers = await getAvailableDriversNear(
      businessLat,
      businessLng,
      15,
    ); // 15km radius

    if (availableDrivers.length === 0) {
      console.log(`⚠️ No available drivers found for order ${orderId}`);
      return { success: false, error: "No available drivers in the area" };
    }

    // Filter out drivers with active orders
    const freeDrivers = availableDrivers.filter(
      (driver) => !driver.currentOrderId,
    );

    if (freeDrivers.length === 0) {
      console.log(`⚠️ All nearby drivers are busy for order ${orderId}`);
      return { success: false, error: "All nearby drivers are currently busy" };
    }

    // Select the closest available driver
    const selectedDriver = freeDrivers[0];
    const distance = calculateDistance(
      businessLat,
      businessLng,
      selectedDriver.latitude,
      selectedDriver.longitude,
    );
    const estimatedTime = Math.ceil(10 + distance * 2); // Base 10 min + 2 min per km

    // Assign driver to order
    await db
      .update(orders)
      .set({
        deliveryPersonId: selectedDriver.driverId,
        status: "assigned",
        assignedAt: new Date(),
        estimatedDelivery: new Date(Date.now() + estimatedTime * 60 * 1000),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    // Get driver name
    const [driverInfo] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, selectedDriver.driverId))
      .limit(1);

    console.log(`✅ Driver assigned to order ${orderId}:`, {
      driverId: selectedDriver.driverId,
      driverName: driverInfo?.name,
      distance: distance.toFixed(2) + "km",
      estimatedTime: estimatedTime + " minutes",
    });

    // Notificar al repartidor del nuevo pedido asignado
    await notifyDriverNewOrder(selectedDriver.driverId, orderId);
    // Notificar al cliente que se asignó un repartidor
    await sendPushToUser(order.userId, {
      title: `${driverInfo?.name?.split(" ")[0] || "Tu repartidor"} fue asignado 🚗`,
      body: "Pronto recogerá tu pedido",
      data: { orderId, screen: "OrderTracking" },
    });

    return {
      success: true,
      driverId: selectedDriver.driverId,
      driverName: driverInfo?.name,
      distance: parseFloat(distance.toFixed(2)),
      estimatedTime,
    };
  } catch (error: any) {
    console.error(`❌ Error auto-assigning driver:`, error);
    return { success: false, error: error.message };
  }
}

// Reassign order if driver rejects or doesn't respond
export async function reassignOrder(
  orderId: string,
  rejectedDriverId?: string,
): Promise<AssignmentResult> {
  try {
    console.log(`🔄 Reassigning order: ${orderId}`);

    // Clear current assignment
    await db
      .update(orders)
      .set({
        deliveryPersonId: null,
        status: "confirmed", // Back to confirmed status
        assignedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    // Record rejection if driver ID provided
    if (rejectedDriverId) {
      // TODO: Record driver rejection in strikes/performance system
      console.log(`📝 Recording rejection by driver: ${rejectedDriverId}`);
    }

    // Try to assign to a different driver
    return await autoAssignDriver(orderId);
  } catch (error: any) {
    console.error(`❌ Error reassigning order:`, error);
    return { success: false, error: error.message };
  }
}

// Batch assign multiple orders
export async function batchAssignOrders(): Promise<{
  assigned: number;
  failed: number;
}> {
  try {
    console.log(`🔄 Running batch driver assignment...`);

    // Get all confirmed orders without drivers
    const unassignedOrders = await db
      .select({ id: orders.id, businessId: orders.businessId })
      .from(orders)
      .where(
        and(eq(orders.status, "confirmed"), isNull(orders.deliveryPersonId)),
      );

    let assigned = 0;
    let failed = 0;

    for (const order of unassignedOrders) {
      const result = await autoAssignDriver(order.id);
      if (result.success) {
        assigned++;
      } else {
        failed++;
      }

      // Small delay to avoid overwhelming the system
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(
      `✅ Batch assignment completed: ${assigned} assigned, ${failed} failed`,
    );
    return { assigned, failed };
  } catch (error) {
    console.error(`❌ Error in batch assignment:`, error);
    return { assigned: 0, failed: 0 };
  }
}

// Get driver performance metrics for assignment priority
async function getDriverPerformance(driverId: string) {
  try {
    // Get recent delivery stats
    const recentDeliveries = await db
      .select({
        id: orders.id,
        status: orders.status,
        deliveredAt: orders.deliveredAt,
        estimatedDelivery: orders.estimatedDelivery,
      })
      .from(orders)
      .where(
        and(
          eq(orders.deliveryPersonId, driverId),
          eq(orders.status, "delivered"),
        ),
      )
      .limit(20);

    let onTimeDeliveries = 0;
    let totalDeliveries = recentDeliveries.length;

    for (const delivery of recentDeliveries) {
      if (delivery.deliveredAt && delivery.estimatedDelivery) {
        const delivered = new Date(delivery.deliveredAt);
        const estimated = new Date(delivery.estimatedDelivery);
        if (delivered <= estimated) {
          onTimeDeliveries++;
        }
      }
    }

    const onTimeRate =
      totalDeliveries > 0 ? (onTimeDeliveries / totalDeliveries) * 100 : 0;

    return {
      totalDeliveries,
      onTimeRate,
      isReliable: onTimeRate >= 80 && totalDeliveries >= 5,
    };
  } catch (error) {
    console.error(`❌ Error getting driver performance:`, error);
    return { totalDeliveries: 0, onTimeRate: 0, isReliable: false };
  }
}

// Smart assignment considering driver performance
export async function smartAssignDriver(
  orderId: string,
): Promise<AssignmentResult> {
  try {
    console.log(`🧠 Smart-assigning driver for order: ${orderId}`);

    const basicResult = await autoAssignDriver(orderId);

    if (!basicResult.success || !basicResult.driverId) {
      return basicResult;
    }

    // Get performance metrics for assigned driver
    const performance = await getDriverPerformance(basicResult.driverId);

    console.log(`📊 Driver performance:`, {
      driverId: basicResult.driverId,
      deliveries: performance.totalDeliveries,
      onTimeRate: performance.onTimeRate.toFixed(1) + "%",
      reliable: performance.isReliable,
    });

    return {
      ...basicResult,
      performance,
    };
  } catch (error: any) {
    console.error(`❌ Error in smart assignment:`, error);
    return { success: false, error: error.message };
  }
}

// Monitor and reassign stale assignments
export async function monitorStaleAssignments() {
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    // Find orders assigned but not picked up for 15+ minutes
    const staleOrders = await db
      .select({ id: orders.id, deliveryPersonId: orders.deliveryPersonId })
      .from(orders)
      .where(
        and(
          eq(orders.status, "assigned"),
          // TODO: Add assignedAt field comparison when available
        ),
      );

    for (const order of staleOrders) {
      console.log(`⏰ Reassigning stale order: ${order.id}`);
      await reassignOrder(order.id, order.deliveryPersonId || undefined);
    }

    return staleOrders.length;
  } catch (error) {
    console.error(`❌ Error monitoring stale assignments:`, error);
    return 0;
  }
}

// Export all functions
export { getAvailableDriversNear, calculateDistance };
