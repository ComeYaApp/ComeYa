import { Alert, Platform } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
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
  /** Rumbo en grados (0-360): imprescindible para rotar pin y cámara. */
  heading?: number;
}

const LOCATION_TASK_NAME = "comeya-driver-location";

// Cadencia de CAPTURA (nivel Uber/Glovo): 1 fix/segundo o cada 5 m.
const WATCH_INTERVAL_MS = 1000;
const WATCH_DISTANCE_M = 5;
// Envío al SERVIDOR: como mucho 1 POST cada 2 s … o al moverse 10 m.
// El servidor re-emite por websocket cada 2 s → movimiento continuo.
const POST_MIN_INTERVAL_MS = 2000;
const POST_MIN_DISTANCE_M = 10;
// Fixes más imprecisos que esto se descartan (ruido del GPS).
const MAX_ACCURACY_M = 50;

/** Convierte un fix de expo-location al formato interno. */
function toFix(loc: Location.LocationObject): GPSLocation {
  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    timestamp: loc.timestamp,
    accuracy: loc.coords.accuracy ?? undefined,
    speed: loc.coords.speed ?? undefined,
    heading:
      typeof loc.coords.heading === "number" && loc.coords.heading >= 0
        ? loc.coords.heading
        : undefined,
  };
}

/** Convierte un fix de la geolocation API web al formato interno. */
function webFix(pos: GeolocationPosition): GPSLocation {
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    timestamp: pos.timestamp,
    accuracy: pos.coords.accuracy ?? undefined,
    speed: pos.coords.speed ?? undefined,
    heading:
      typeof pos.coords.heading === "number" && pos.coords.heading >= 0
        ? pos.coords.heading
        : undefined,
  };
}

class GPSService {
  private locationSubscription: Location.LocationSubscription | null = null;
  private webWatchId: number | null = null;
  private isTracking = false;
  private activeOrders: Set<string> = new Set();

  // ── Throttle de envío al servidor ──
  private lastPostAt = 0;
  private lastPostedPos: { lat: number; lng: number } | null = null;
  private lastQueuedOfflineAt = 0;

  // ── Suscriptores (pantallas que quieren cada fix para render fluido) ──
  private listeners = new Set<(fix: GPSLocation) => void>();

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
            (position) => resolve(webFix(position)),
            (error) => {
              console.error("Web geolocation error:", error);
              resolve(null);
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 5000,
            },
          );
        });
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });

      return toFix(location);
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
          (position) => this.handleFix(webFix(position)),
          (error) => {
            console.error("Web GPS tracking error:", error);
            this.stopTracking();
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 5000,
          },
        );
      } else {
        // Warm-up: primer fix YA (mejora el "GPS tarda mucho en arrancar")
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
        })
          .then((loc) => this.handleFix(toFix(loc)))
          .catch(() => {});

        // 1) Tarea de UBICACIÓN EN SEGUNDO PLANO: Android foreground-service
        //    (notificación persistente, sigue con pantalla bloqueada, SIN
        //    ACCESS_BACKGROUND_LOCATION) · iOS UIBackgroundModes location.
        const bgStarted = await this.startBackgroundTask();
        if (bgStarted) {
          this.isTracking = true;
          console.log("✅ GPS tracking started (background task)");
          return true;
        }

        // 2) Fallback: watch en primer plano (mismos parámetros)
        this.locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: WATCH_INTERVAL_MS,
            distanceInterval: WATCH_DISTANCE_M,
          },
          (location) => this.handleFix(toFix(location)),
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

  /** Registra la tarea de ubicación en segundo plano (Android/iOS). */
  private async startBackgroundTask(): Promise<boolean> {
    try {
      const already =
        await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (!already) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: WATCH_INTERVAL_MS,
          distanceInterval: WATCH_DISTANCE_M,
          deferredUpdatesInterval: WATCH_INTERVAL_MS,
          pausesUpdatesAutomatically: false,
          showsBackgroundLocationIndicator: true,
          // Android: servicio en primer plano con notificación persistente
          // (permite localizar con la pantalla bloqueada sin pedir
          // ACCESS_BACKGROUND_LOCATION ni declaración extra en Play).
          foregroundService: {
            notificationTitle: "Reparto en curso",
            notificationBody:
              "ComeYa transmite tu ubicación en tiempo real durante la entrega",
            notificationColor: "#DC2626",
            killServiceOnDestroy: false,
          },
        });
      }
      return true;
    } catch (error) {
      console.warn(
        "Background location task unavailable, using foreground watch:",
        error,
      );
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
        TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME)
          .then((registered: boolean) =>
            registered
              ? Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME)
              : null,
          )
          .catch(() => {});
      }

      this.isTracking = false;
      console.log("🛑 GPS tracking stopped");
    } catch (error) {
      console.error("Error stopping GPS tracking:", error);
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // Procesado de cada fix: breadcrumb + listeners + envío throttled
  // ────────────────────────────────────────────────────────────────────────
  handleFix(location: GPSLocation): void {
    // Fixes imprecisos: se descartan (provocan teletransportes en el mapa)
    if (location.accuracy && location.accuracy > MAX_ACCURACY_M) {
      return;
    }

    // Breadcrumbs para la prueba de entrega de cada pedido activo
    for (const orderId of this.activeOrders) {
      deliveryProofService.addRoutePoint(orderId, {
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: location.timestamp || Date.now(),
        accuracy: location.accuracy,
        speed: location.speed,
      });
    }

    // Pantallas suscritas (render fluido con heading)
    this.listeners.forEach((fn) => {
      try {
        fn(location);
      } catch {}
    });

    // Envío al servidor (throttle interno: 1 POST cada 2 s o al mover 10 m)
    this.postFix(location);
  }

  /** Envía un fix al servidor con throttle temporal/por distancia (con
   *  fallback a la cola offline si falla). Público: las pantallas de
   *  navegación con watch propio lo reutilizan para no duplicar POSTs. */
  async postFix(location: GPSLocation): Promise<void> {
    const now = Date.now();
    const movedEnough =
      !this.lastPostedPos ||
      this.calculateDistance(
        this.lastPostedPos.lat,
        this.lastPostedPos.lng,
        location.latitude,
        location.longitude,
      ) >= POST_MIN_DISTANCE_M;

    if (now - this.lastPostAt < POST_MIN_INTERVAL_MS && !movedEnough) return;

    this.lastPostAt = now;
    this.lastPostedPos = { lat: location.latitude, lng: location.longitude };

    try {
      await apiRequest("POST", "/api/delivery/location", {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        heading: location.heading,
        speed: location.speed,
        timestamp: location.timestamp || now,
      });
    } catch {
      // Sin red: encolar (máx. 1 cada 10 s para no saturar AsyncStorage)
      if (now - this.lastQueuedOfflineAt >= 10000) {
        this.lastQueuedOfflineAt = now;
        offlineGPSService.queueLocation({
          latitude: location.latitude,
          longitude: location.longitude,
          timestamp: location.timestamp || now,
        });
      }
    }
  }

  /** Suscribe una pantalla a cada fix (render fluido). Devuelve unsubscriber. */
  subscribe(fn: (fix: GPSLocation) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
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
      location.accuracy > MAX_ACCURACY_M
    ) {
      Alert.alert(
        "GPS Impreciso",
        `La precisión del GPS es de ${Math.round(location.accuracy)}m. Espera a tener mejor señal (menos de ${MAX_ACCURACY_M}m).`,
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

// ──────────────────────────────────────────────────────────────────────────
// Tarea de UBICACIÓN EN SEGUNDO PLANO (Android foreground-service · iOS
// background mode). defineTask debe ejecutarse a nivel de módulo para que
// exista cuando el sistema relanza la app en segundo plano.
// ──────────────────────────────────────────────────────────────────────────
if (Platform.OS !== "web") {
  try {
    TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
      LOCATION_TASK_NAME,
      async ({ data, error }) => {
        if (error) {
          console.warn("Driver location task error:", error);
          return;
        }
        const locations = data?.locations;
        if (Array.isArray(locations)) {
          for (const loc of locations) {
            gpsService.handleFix(toFix(loc));
          }
        }
      },
    );
  } catch (e) {
    console.warn("TaskManager defineTask failed:", e);
  }
}
