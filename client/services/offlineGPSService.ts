import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as Location from "expo-location";
import { apiRequest } from "@/lib/query-client";

interface QueuedLocation {
  latitude: number;
  longitude: number;
  timestamp: number;
  orderId?: string;
}

interface CachedMapData {
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  tiles: string[];
  cachedAt: number;
}

const LOCATION_QUEUE_KEY = "@ComeYa_location_queue";
const CACHED_MAPS_KEY = "@ComeYa_cached_maps";
const LAST_LOCATION_KEY = "@ComeYa_last_location";

class OfflineGPSService {
  private isOnline: boolean = true;
  private locationQueue: QueuedLocation[] = [];
  private processingQueue: boolean = false;

  constructor() {
    this.initNetworkListener();
    this.loadQueue();
  }

  // Initialize network listener
  private initNetworkListener(): void {
    NetInfo.addEventListener((state) => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;

      console.log(`📡 Network status: ${this.isOnline ? "Online" : "Offline"}`);

      // If we just came back online, process queue
      if (wasOffline && this.isOnline) {
        this.processQueue();
      }
    });
  }

  // Load queued locations from storage
  private async loadQueue(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(LOCATION_QUEUE_KEY);
      if (stored) {
        this.locationQueue = JSON.parse(stored);
        console.log(`📦 Loaded ${this.locationQueue.length} queued locations`);
      }
    } catch (error) {
      console.error("Error loading location queue:", error);
    }
  }

  // Save queue to storage
  private async saveQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        LOCATION_QUEUE_KEY,
        JSON.stringify(this.locationQueue),
      );
    } catch (error) {
      console.error("Error saving location queue:", error);
    }
  }

  // Add location to queue
  async queueLocation(location: QueuedLocation): Promise<void> {
    this.locationQueue.push(location);
    await this.saveQueue();

    // Save as last known location
    await this.saveLastLocation(location);

    console.log(`📍 Location queued (${this.locationQueue.length} in queue)`);

    // Try to process if online
    if (this.isOnline) {
      await this.processQueue();
    }
  }

  // Process queued locations
  private async processQueue(): Promise<void> {
    if (
      this.processingQueue ||
      this.locationQueue.length === 0 ||
      !this.isOnline
    ) {
      return;
    }

    this.processingQueue = true;
    console.log(
      `🔄 Processing ${this.locationQueue.length} queued locations...`,
    );

    const batch = [...this.locationQueue];
    const failed: QueuedLocation[] = [];

    for (const location of batch) {
      try {
        await apiRequest("POST", "/api/delivery/location", {
          latitude: location.latitude,
          longitude: location.longitude,
          timestamp: location.timestamp,
          orderId: location.orderId,
        });
        console.log(
          `✅ Synced location from ${new Date(location.timestamp).toLocaleTimeString()}`,
        );
      } catch (error) {
        console.error("Failed to sync location:", error);
        failed.push(location);
      }
    }

    // Keep only failed locations in queue
    this.locationQueue = failed;
    await this.saveQueue();

    this.processingQueue = false;
    console.log(`✅ Queue processed. ${failed.length} failed.`);
  }

  // Save last known location
  private async saveLastLocation(location: QueuedLocation): Promise<void> {
    try {
      await AsyncStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(location));
    } catch (error) {
      console.error("Error saving last location:", error);
    }
  }

  // Get last known location
  async getLastKnownLocation(): Promise<QueuedLocation | null> {
    try {
      const stored = await AsyncStorage.getItem(LAST_LOCATION_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error("Error getting last location:", error);
    }
    return null;
  }

  // Cache map data for San Cristóbal region
  async cacheMapRegion(region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }): Promise<void> {
    try {
      const cached: CachedMapData = {
        region,
        tiles: [], // In production, you'd cache actual map tiles
        cachedAt: Date.now(),
      };

      await AsyncStorage.setItem(CACHED_MAPS_KEY, JSON.stringify(cached));
      console.log("🗺️ Map region cached");
    } catch (error) {
      console.error("Error caching map:", error);
    }
  }

  // Get cached map data
  async getCachedMapRegion(): Promise<CachedMapData | null> {
    try {
      const stored = await AsyncStorage.getItem(CACHED_MAPS_KEY);
      if (stored) {
        const cached: CachedMapData = JSON.parse(stored);

        // Check if cache is still valid (7 days)
        const age = Date.now() - cached.cachedAt;
        if (age < 7 * 24 * 60 * 60 * 1000) {
          return cached;
        }
      }
    } catch (error) {
      console.error("Error getting cached map:", error);
    }
    return null;
  }

  // Get current location with offline fallback
  async getCurrentLocation(): Promise<{
    latitude: number;
    longitude: number;
    isFromCache: boolean;
  } | null> {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeoutMs: 5000,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        isFromCache: false,
      };
    } catch (error) {
      console.log("⚠️ Could not get current location, using cached");

      // Fallback to last known location
      const lastKnown = await this.getLastKnownLocation();
      if (lastKnown) {
        return {
          latitude: lastKnown.latitude,
          longitude: lastKnown.longitude,
          isFromCache: true,
        };
      }
    }
    return null;
  }

  // Check if online
  isCurrentlyOnline(): boolean {
    return this.isOnline;
  }

  // Get queue size
  getQueueSize(): number {
    return this.locationQueue.length;
  }

  // Clear queue
  async clearQueue(): Promise<void> {
    this.locationQueue = [];
    await this.saveQueue();
    console.log("🧹 Location queue cleared");
  }
}

export const offlineGPSService = new OfflineGPSService();
