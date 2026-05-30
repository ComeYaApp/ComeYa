import { apiRequest } from "@/lib/query-client";

export interface DeliveryPoint {
  orderId: string;
  latitude: number;
  longitude: number;
  address: string;
  priority: number; // 1 = pickup, 2 = delivery
  estimatedTime?: number;
}

export interface OptimizedRoute {
  orderId: string;
  sequence: number;
  distance: number; // meters
  duration: number; // seconds
  address: string;
  type: "pickup" | "delivery";
}

class RouteOptimizationService {
  // Calculate distance between two points (Haversine)
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

  // Nearest neighbor algorithm for route optimization
  async optimizeRoute(
    currentLocation: { latitude: number; longitude: number },
    deliveryPoints: DeliveryPoint[],
  ): Promise<OptimizedRoute[]> {
    if (deliveryPoints.length === 0) return [];
    if (deliveryPoints.length === 1) {
      return [
        {
          orderId: deliveryPoints[0].orderId,
          sequence: 1,
          distance: this.calculateDistance(
            currentLocation.latitude,
            currentLocation.longitude,
            deliveryPoints[0].latitude,
            deliveryPoints[0].longitude,
          ),
          duration: this.estimateDuration(
            this.calculateDistance(
              currentLocation.latitude,
              currentLocation.longitude,
              deliveryPoints[0].latitude,
              deliveryPoints[0].longitude,
            ),
          ),
          address: deliveryPoints[0].address,
          type: deliveryPoints[0].priority === 1 ? "pickup" : "delivery",
        },
      ];
    }

    const optimized: OptimizedRoute[] = [];
    const remaining = [...deliveryPoints];
    let current = currentLocation;
    let sequence = 1;

    // First, handle all pickups (priority 1)
    const pickups = remaining.filter((p) => p.priority === 1);
    const deliveries = remaining.filter((p) => p.priority === 2);

    // Optimize pickups
    while (pickups.length > 0) {
      let nearestIndex = 0;
      let minDistance = Infinity;

      pickups.forEach((point, index) => {
        const distance = this.calculateDistance(
          current.latitude,
          current.longitude,
          point.latitude,
          point.longitude,
        );
        if (distance < minDistance) {
          minDistance = distance;
          nearestIndex = index;
        }
      });

      const nearest = pickups[nearestIndex];
      optimized.push({
        orderId: nearest.orderId,
        sequence: sequence++,
        distance: minDistance,
        duration: this.estimateDuration(minDistance),
        address: nearest.address,
        type: "pickup",
      });

      current = { latitude: nearest.latitude, longitude: nearest.longitude };
      pickups.splice(nearestIndex, 1);
    }

    // Then optimize deliveries
    while (deliveries.length > 0) {
      let nearestIndex = 0;
      let minDistance = Infinity;

      deliveries.forEach((point, index) => {
        const distance = this.calculateDistance(
          current.latitude,
          current.longitude,
          point.latitude,
          point.longitude,
        );
        if (distance < minDistance) {
          minDistance = distance;
          nearestIndex = index;
        }
      });

      const nearest = deliveries[nearestIndex];
      optimized.push({
        orderId: nearest.orderId,
        sequence: sequence++,
        distance: minDistance,
        duration: this.estimateDuration(minDistance),
        address: nearest.address,
        type: "delivery",
      });

      current = { latitude: nearest.latitude, longitude: nearest.longitude };
      deliveries.splice(nearestIndex, 1);
    }

    return optimized;
  }

  // Estimate duration based on distance (assuming 30 km/h average in city)
  private estimateDuration(distanceMeters: number): number {
    const speedKmH = 30;
    const speedMs = (speedKmH * 1000) / 3600;
    return Math.round(distanceMeters / speedMs);
  }

  // Get optimized route with Google Maps Distance Matrix API
  async getOptimizedRouteWithTraffic(
    currentLocation: { latitude: number; longitude: number },
    deliveryPoints: DeliveryPoint[],
    googleMapsApiKey: string,
  ): Promise<OptimizedRoute[]> {
    try {
      // Use Google Maps Distance Matrix API for accurate times
      const origins = `${currentLocation.latitude},${currentLocation.longitude}`;
      const destinations = deliveryPoints
        .map((p) => `${p.latitude},${p.longitude}`)
        .join("|");

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins}&destinations=${destinations}&mode=driving&departure_time=now&key=${googleMapsApiKey}`,
      );

      const data = await response.json();

      if (data.status === "OK" && data.rows[0]) {
        const elements = data.rows[0].elements;
        const routesWithTraffic = deliveryPoints.map((point, index) => ({
          orderId: point.orderId,
          sequence: index + 1,
          distance: elements[index]?.distance?.value || 0,
          duration:
            elements[index]?.duration_in_traffic?.value ||
            elements[index]?.duration?.value ||
            0,
          address: point.address,
          type: (point.priority === 1 ? "pickup" : "delivery") as
            | "pickup"
            | "delivery",
        }));

        // Sort by duration (nearest first)
        return routesWithTraffic.sort((a, b) => a.duration - b.duration);
      }
    } catch (error) {
      console.error("Error getting route with traffic:", error);
    }

    // Fallback to basic optimization
    return this.optimizeRoute(currentLocation, deliveryPoints);
  }

  // Calculate total route distance and time
  calculateRouteTotals(route: OptimizedRoute[]): {
    totalDistance: number;
    totalDuration: number;
    formattedDistance: string;
    formattedDuration: string;
  } {
    const totalDistance = route.reduce((sum, r) => sum + r.distance, 0);
    const totalDuration = route.reduce((sum, r) => sum + r.duration, 0);

    return {
      totalDistance,
      totalDuration,
      formattedDistance: `${(totalDistance / 1000).toFixed(1)} km`,
      formattedDuration: `${Math.round(totalDuration / 60)} min`,
    };
  }
}

export const routeOptimizationService = new RouteOptimizationService();
