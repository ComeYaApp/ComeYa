import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { apiRequest } from "@/lib/query-client";

export interface GeofenceRegion {
  id: string;
  latitude: number;
  longitude: number;
  radius: number; // meters
  type: "business" | "customer";
  orderId: string;
}

class GeofencingService {
  private activeGeofences: Map<string, GeofenceRegion> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private lastLocation: { latitude: number; longitude: number } | null = null;

  // Calculate distance between two coordinates (Haversine formula)
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  // Add geofence for an order
  async addGeofence(region: GeofenceRegion): Promise<void> {
    this.activeGeofences.set(region.id, region);
    console.log(
      `📍 Geofence added: ${region.type} for order ${region.orderId}`,
    );

    if (!this.checkInterval) {
      this.startMonitoring();
    }
  }

  // Remove geofence
  removeGeofence(id: string): void {
    this.activeGeofences.delete(id);
    console.log(`🗑️ Geofence removed: ${id}`);

    if (this.activeGeofences.size === 0 && this.checkInterval) {
      this.stopMonitoring();
    }
  }

  // Start monitoring geofences
  private startMonitoring(): void {
    if (this.checkInterval) return;

    this.checkInterval = setInterval(async () => {
      try {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        this.lastLocation = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };

        this.checkGeofences(this.lastLocation);
      } catch (error) {
        console.error("Error monitoring geofences:", error);
      }
    }, 15000); // Check every 15 seconds

    console.log("🔍 Geofence monitoring started");
  }

  // Stop monitoring
  private stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log("🛑 Geofence monitoring stopped");
    }
  }

  // Check if driver is inside any geofence
  private async checkGeofences(currentLocation: {
    latitude: number;
    longitude: number;
  }): Promise<void> {
    for (const [id, region] of this.activeGeofences) {
      const distance = this.calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        region.latitude,
        region.longitude,
      );

      if (distance <= region.radius) {
        await this.onGeofenceEnter(region, distance);
      } else if (distance > region.radius * 3) {
        // Driver is far from route
        await this.onGeofenceDeviation(region, distance);
      }
    }
  }

  // Handle geofence entry
  private async onGeofenceEnter(
    region: GeofenceRegion,
    distance: number,
  ): Promise<void> {
    console.log(
      `✅ Entered geofence: ${region.type} (${distance.toFixed(0)}m)`,
    );

    // Send notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title:
          region.type === "business"
            ? "🏪 Llegaste al negocio"
            : "🏠 Llegaste con el cliente",
        body:
          region.type === "business"
            ? 'Recoge el pedido y marca como "Recogido"'
            : 'Entrega el pedido y marca como "Entregado"',
        data: { orderId: region.orderId, type: region.type },
      },
      trigger: null,
    });

    // Notify backend
    try {
      await apiRequest("POST", "/api/gps/geofence-event", {
        orderId: region.orderId,
        type: "enter",
        location: region.type,
        distance,
      });
    } catch (error) {
      console.error("Error notifying geofence entry:", error);
    }
  }

  // Handle route deviation
  private async onGeofenceDeviation(
    region: GeofenceRegion,
    distance: number,
  ): Promise<void> {
    console.log(
      `⚠️ Route deviation detected: ${distance.toFixed(0)}m from ${region.type}`,
    );

    // Only alert if driver is supposed to be heading there
    if (region.type === "customer") {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "⚠️ Alerta de ruta",
          body: `Te has alejado ${(distance / 1000).toFixed(1)}km del destino`,
          data: { orderId: region.orderId },
        },
        trigger: null,
      });
    }
  }

  // Clear all geofences
  clearAll(): void {
    this.activeGeofences.clear();
    this.stopMonitoring();
    console.log("🧹 All geofences cleared");
  }

  // Get active geofences count
  getActiveCount(): number {
    return this.activeGeofences.size;
  }
}

export const geofencingService = new GeofencingService();
