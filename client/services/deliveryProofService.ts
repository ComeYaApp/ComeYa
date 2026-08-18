import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { apiRequest } from "@/lib/query-client";

export interface DeliveryProof {
  orderId: string;
  photoUri: string;
  photoBase64?: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
}

export interface RoutePoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
  speed?: number;
}

class DeliveryProofService {
  private routeBreadcrumbs: Map<string, RoutePoint[]> = new Map();

  // Request camera permissions
  async requestCameraPermissions(): Promise<boolean> {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === "granted";
  }

  // Capture delivery photo
  async captureDeliveryPhoto(): Promise<string | null> {
    try {
      const hasPermission = await this.requestCameraPermissions();
      if (!hasPermission) {
        throw new Error(
          "Se requiere permiso de cámara para tomar la foto de entrega",
        );
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7, // Compress to reduce upload size
        exif: true, // Include GPS data if available
      });

      if (!result.canceled && result.assets[0]) {
        return result.assets[0].uri;
      }

      return null;
    } catch (error) {
      console.error("Error capturing photo:", error);
      throw error;
    }
  }

  // Convert image to base64 for upload
  async imageToBase64(uri: string): Promise<string> {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return base64;
    } catch (error) {
      console.error("Error converting image to base64:", error);
      throw error;
    }
  }

  // Submit delivery proof
  async submitDeliveryProof(proof: DeliveryProof): Promise<void> {
    try {
      // Convert photo to base64
      const photoBase64 = await this.imageToBase64(proof.photoUri);

      // Get route breadcrumbs for this order
      const route = this.routeBreadcrumbs.get(proof.orderId) || [];

      // Submit to backend (el handler vive en el router /api/gps)
      await apiRequest("POST", `/api/gps/proof/${proof.orderId}`, {
        photoBase64,
        latitude: proof.latitude,
        longitude: proof.longitude,
        timestamp: proof.timestamp,
        accuracy: proof.accuracy,
        route: route.slice(-50), // Send last 50 points
      });

      console.log("✅ Delivery proof submitted");

      // Clear route for this order
      this.routeBreadcrumbs.delete(proof.orderId);
    } catch (error) {
      console.error("Error submitting delivery proof:", error);
      throw error;
    }
  }

  // Start tracking route for an order
  startRouteTracking(orderId: string): void {
    if (!this.routeBreadcrumbs.has(orderId)) {
      this.routeBreadcrumbs.set(orderId, []);
      console.log(`🗺️ Started route tracking for order ${orderId}`);
    }
  }

  // Add point to route
  addRoutePoint(orderId: string, point: RoutePoint): void {
    const route = this.routeBreadcrumbs.get(orderId);
    if (route) {
      route.push(point);

      // Keep only last 100 points to avoid memory issues
      if (route.length > 100) {
        route.shift();
      }

      console.log(
        `📍 Route point added for ${orderId} (${route.length} points)`,
      );
    }
  }

  // Stop tracking route
  stopRouteTracking(orderId: string): RoutePoint[] {
    const route = this.routeBreadcrumbs.get(orderId) || [];
    this.routeBreadcrumbs.delete(orderId);
    console.log(`🛑 Stopped route tracking for order ${orderId}`);
    return route;
  }

  // Get route for order
  getRoute(orderId: string): RoutePoint[] {
    return this.routeBreadcrumbs.get(orderId) || [];
  }

  // Calculate route distance
  calculateRouteDistance(route: RoutePoint[]): number {
    if (route.length < 2) return 0;

    let totalDistance = 0;
    for (let i = 1; i < route.length; i++) {
      const prev = route[i - 1];
      const curr = route[i];
      totalDistance += this.calculateDistance(
        prev.latitude,
        prev.longitude,
        curr.latitude,
        curr.longitude,
      );
    }

    return totalDistance;
  }

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

  // Get active tracking count
  getActiveTrackingCount(): number {
    return this.routeBreadcrumbs.size;
  }
}

export const deliveryProofService = new DeliveryProofService();
