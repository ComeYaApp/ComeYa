import { Alert, Platform } from "react-native";
import * as Location from "expo-location";
import { apiRequest } from "@/lib/query-client";
import { offlineGPSService } from "./offlineGPSService";
import { deliveryProofService } from "./deliveryProofService";
import { proximityNotificationService } from "./proximityNotificationService";
import { geofencingService } from "./geofencingService";

export interface GPSLocation {
  latitude: number;
  longitude: number;
  timestamp?: number;
  accuracy?: number;
  speed?: number;
}

class GPSService {
  private locationSubscription: Location.LocationSubscription | null = null;
  private webWatchId: number | null = null;
  private isTracking = false;
  private lastUpdate = 0;
  private readonly UPDATE_INTERVAL = 10000; // 10 seconds
  private readonly MIN_ACCURACY = 50; // meters
  private activeOrders: Set<string> = new Set();

  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === "web") {
        return new Promise((resolve) => {
          if (!navigator.geolocation) {
            console.log("Geolocation not supported");
            resolve(false);
            return;
          }

          navigator.permissions
            .query({ name: "geolocation" })
            .then((result) => {
              resolve(result.state === "granted" || result.state === "prompt");
            })
            .catch(() => {
              resolve(true);
            });
        });
      }

      const { status, canAskAgain } =
        await Location.requestForegroundPermissionsAsync();
      const granted = status === "granted";

      if (!granted) {
        const message = canAskAgain
          ? "Activa el GPS para continuar con las entregas."
          : "Activa el GPS desde ajustes para continuar con las entregas.";
        Alert.alert("GPS requerido", message);
      }

      return granted;
    } catch (error) {
      console.error("Error requesting GPS permissions:", error);
      return false;
    }
  }

  async getCurrentLocation(): Promise<GPSLocation | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return null;
      }

      if (Platform.OS === "web") {
        return new Promise((resolve) => {
          if (!navigator.geolocation) {
            resolve(null);
            return;
          }

          navigator.geolocation.getCurrentPosition(
            (position) => {
              resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                timestamp: position.timestamp,
                accuracy: position.coords.accuracy,
                speed: position.coords.speed || undefined,
              });
            },
            (error) => {
              console.error("Web geolocation error:", error);
              resolve(null);
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 60000,
            },
          );
        });
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeoutMs: 10000,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: location.timestamp,
        accuracy: location.coords.accuracy,
        speed: location.coords.speed || undefined,
      };
    } catch (error) {
      console.error("Error getting current location:", error);

      // Try offline fallback
      const cached = await offlineGPSService.getCurrentLocation();
      if (cached) {
        return {
          latitude: cached.latitude,
          longitude: cached.longitude,
          timestamp: Date.now(),
        };
      }

      return null;
    }
  }

  async startTracking(): Promise<boolean> {
    if (this.isTracking) return true;

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      console.log("GPS permission denied");
      this.isTracking = false;
      return false;
    }

    try {
      if (Platform.OS === "web") {
        if (!navigator.geolocation) return false;

        this.webWatchId = navigator.geolocation.watchPosition(
          (position) => {
            const now = Date.now();
            if (now - this.lastUpdate >= this.UPDATE_INTERVAL) {
              this.updateLocation({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                timestamp: position.timestamp,
                accuracy: position.coords.accuracy,
                speed: position.coords.speed || undefined,
              });
              this.lastUpdate = now;
            }
          },
          (error) => {
            console.error("Web GPS tracking error:", error);
            this.stopTracking();
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 30000,
          },
        );
      } else {
        this.locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: this.UPDATE_INTERVAL,
            distanceInterval: 50,
          },
          (location) => {
            this.updateLocation({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              timestamp: location.timestamp,
              accuracy: location.coords.accuracy,
              speed: location.coords.speed || undefined,
            });
          },
        );
      }

      this.isTracking = true;
      console.log("✅ GPS tracking started");
      return true;
    } catch (error) {
      console.error("Error starting GPS tracking:", error);
      this.stopTracking();
      return false;
    }
  }

  stopTracking(): void {
    if (!this.isTracking) return;

    try {
      if (Platform.OS === "web") {
        if (this.webWatchId !== null) {
          navigator.geolocation.clearWatch(this.webWatchId);
          this.webWatchId = null;
        }
      } else {
        if (this.locationSubscription) {
          this.locationSubscription.remove();
          this.locationSubscription = null;
        }
      }

      this.isTracking = false;
      console.log("🛑 GPS tracking stopped");
    } catch (error) {
      console.error("Error stopping GPS tracking:", error);
    }
  }

  private async updateLocation(location: GPSLocation): Promise<void> {
    // Validate GPS accuracy
    if (location.accuracy && location.accuracy > this.MIN_ACCURACY) {
      console.warn(`⚠️ Low GPS accuracy: ${location.accuracy}m`);
      return;
    }

    // Add to route tracking for active orders
    for (const orderId of this.activeOrders) {
      deliveryProofService.addRoutePoint(orderId, {
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: location.timestamp || Date.now(),
        accuracy: location.accuracy,
        speed: location.speed,
      });
    }

    // Queue location update (handles offline)
    await offlineGPSService.queueLocation({
      latitude: location.latitude,
      longitude: location.longitude,
      timestamp: location.timestamp || Date.now(),
    });

    console.log("📍 Location updated:", location.latitude, location.longitude);
  }

  isCurrentlyTracking(): boolean {
    return this.isTracking;
  }

  async getLocationForDelivery(): Promise<GPSLocation | null> {
    console.log("🎯 Getting location for delivery confirmation...");
    const location = await this.getCurrentLocation();

    // Validate accuracy
    if (
      location &&
      location.accuracy &&
      location.accuracy > this.MIN_ACCURACY
    ) {
      Alert.alert(
        "GPS Impreciso",
        `La precisión del GPS es de ${Math.round(location.accuracy)}m. Espera a tener mejor señal (menos de ${this.MIN_ACCURACY}m).`,
        [{ text: "OK" }],
      );
      return null;
    }

    return location;
  }

  // Validate delivery location (within 100m of destination)
  async validateDeliveryLocation(
    currentLocation: GPSLocation,
    destinationLat: number,
    destinationLng: number,
  ): Promise<{ valid: boolean; distance: number }> {
    const distance = this.calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      destinationLat,
      destinationLng,
    );

    return {
      valid: distance <= 100,
      distance: Math.round(distance),
    };
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

  // Start tracking order
  startOrderTracking(orderId: string): void {
    this.activeOrders.add(orderId);
    deliveryProofService.startRouteTracking(orderId);
    console.log(`📍 Started tracking order ${orderId}`);
  }

  // Stop tracking order
  stopOrderTracking(orderId: string): void {
    this.activeOrders.delete(orderId);
    deliveryProofService.stopRouteTracking(orderId);
    proximityNotificationService.clearOrderNotifications(orderId);
    console.log(`🛑 Stopped tracking order ${orderId}`);
  }

  // Get active orders count
  getActiveOrdersCount(): number {
    return this.activeOrders.size;
  }
}

export const gpsService = new GPSService();
