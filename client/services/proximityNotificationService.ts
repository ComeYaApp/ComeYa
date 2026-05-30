import * as Notifications from "expo-notifications";
import { apiRequest } from "@/lib/query-client";

export interface ProximityAlert {
  orderId: string;
  type: "approaching" | "arrived" | "nearby";
  distance: number; // meters
  estimatedTime?: number; // seconds
}

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class ProximityNotificationService {
  private sentNotifications: Set<string> = new Set();
  private readonly APPROACHING_DISTANCE = 1000; // 1km
  private readonly ARRIVED_DISTANCE = 50; // 50m
  private readonly NEARBY_DISTANCE = 200; // 200m

  // Calculate distance between two points
  private calculateDistance(
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

  // Estimate time based on distance (30 km/h average)
  private estimateTime(distanceMeters: number): number {
    const speedKmH = 30;
    const speedMs = (speedKmH * 1000) / 3600;
    return Math.round(distanceMeters / speedMs);
  }

  // Check proximity and send notifications
  async checkProximity(
    orderId: string,
    driverLocation: { latitude: number; longitude: number },
    destinationLocation: { latitude: number; longitude: number },
    destinationType: "business" | "customer",
  ): Promise<void> {
    const distance = this.calculateDistance(
      driverLocation.latitude,
      driverLocation.longitude,
      destinationLocation.latitude,
      destinationLocation.longitude,
    );

    const estimatedTime = this.estimateTime(distance);

    // Check if driver is approaching (1km)
    if (
      distance <= this.APPROACHING_DISTANCE &&
      distance > this.NEARBY_DISTANCE &&
      !this.sentNotifications.has(`${orderId}-approaching`)
    ) {
      await this.sendApproachingNotification(
        orderId,
        destinationType,
        distance,
        estimatedTime,
      );
      this.sentNotifications.add(`${orderId}-approaching`);
    }

    // Check if driver is nearby (200m)
    if (
      distance <= this.NEARBY_DISTANCE &&
      distance > this.ARRIVED_DISTANCE &&
      !this.sentNotifications.has(`${orderId}-nearby`)
    ) {
      await this.sendNearbyNotification(orderId, destinationType, distance);
      this.sentNotifications.add(`${orderId}-nearby`);
    }

    // Check if driver has arrived (50m)
    if (
      distance <= this.ARRIVED_DISTANCE &&
      !this.sentNotifications.has(`${orderId}-arrived`)
    ) {
      await this.sendArrivedNotification(orderId, destinationType);
      this.sentNotifications.add(`${orderId}-arrived`);
    }
  }

  // Send approaching notification
  private async sendApproachingNotification(
    orderId: string,
    destinationType: "business" | "customer",
    distance: number,
    estimatedTime: number,
  ): Promise<void> {
    const minutes = Math.ceil(estimatedTime / 60);

    const title =
      destinationType === "customer"
        ? "🚚 Tu pedido está cerca"
        : "🚚 Repartidor en camino";

    const body =
      destinationType === "customer"
        ? `Tu repartidor llegará en aproximadamente ${minutes} minutos`
        : `El repartidor llegará en ${minutes} minutos. Prepara el pedido.`;

    await this.sendLocalNotification(title, body, orderId);
    await this.notifyBackend(orderId, "approaching", distance, destinationType);
  }

  // Send nearby notification
  private async sendNearbyNotification(
    orderId: string,
    destinationType: "business" | "customer",
    distance: number,
  ): Promise<void> {
    const title =
      destinationType === "customer"
        ? "📍 Tu repartidor está muy cerca"
        : "📍 Repartidor cerca del negocio";

    const body =
      destinationType === "customer"
        ? "Prepárate para recibir tu pedido"
        : "El repartidor está a punto de llegar";

    await this.sendLocalNotification(title, body, orderId);
    await this.notifyBackend(orderId, "nearby", distance, destinationType);
  }

  // Send arrived notification
  private async sendArrivedNotification(
    orderId: string,
    destinationType: "business" | "customer",
  ): Promise<void> {
    const title =
      destinationType === "customer"
        ? "🎉 Tu repartidor ha llegado"
        : "✅ Repartidor en el negocio";

    const body =
      destinationType === "customer"
        ? "Tu pedido está siendo entregado"
        : "Entrega el pedido al repartidor";

    await this.sendLocalNotification(title, body, orderId);
    await this.notifyBackend(orderId, "arrived", 0, destinationType);
  }

  // Send local notification
  private async sendLocalNotification(
    title: string,
    body: string,
    orderId: string,
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { orderId, type: "proximity" },
          sound: true,
        },
        trigger: null,
      });
      console.log(`🔔 Notification sent: ${title}`);
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  }

  // Notify backend
  private async notifyBackend(
    orderId: string,
    type: string,
    distance: number,
    destinationType: string,
  ): Promise<void> {
    try {
      await apiRequest("POST", "/api/delivery/proximity-alert", {
        orderId,
        type,
        distance,
        destinationType,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("Error notifying backend:", error);
    }
  }

  // Clear notifications for order
  clearOrderNotifications(orderId: string): void {
    this.sentNotifications.delete(`${orderId}-approaching`);
    this.sentNotifications.delete(`${orderId}-nearby`);
    this.sentNotifications.delete(`${orderId}-arrived`);
    console.log(`🧹 Cleared notifications for order ${orderId}`);
  }

  // Clear all notifications
  clearAll(): void {
    this.sentNotifications.clear();
    console.log("🧹 All proximity notifications cleared");
  }

  // Request notification permissions
  async requestPermissions(): Promise<boolean> {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === "granted";
  }
}

export const proximityNotificationService = new ProximityNotificationService();
