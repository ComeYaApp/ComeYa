import { useState, useEffect, useRef, useCallback } from "react";
import * as Location from "expo-location";

// Cache for geocoding results
const geocodingCache = new Map<string, any>();
const reverseGeocodingCache = new Map<string, any>();

// Debounce utility
export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Optimized geocoding hook
export const useOptimizedGeocoding = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const geocode = useCallback(async (address: string) => {
    if (!address || address.length < 3) return null;

    const cacheKey = address.toLowerCase().trim();

    // Check cache first
    if (geocodingCache.has(cacheKey)) {
      return geocodingCache.get(cacheKey);
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setIsLoading(true);
    setError(null);

    try {
      const result = await Location.geocodeAsync(address);

      if (result && result.length > 0) {
        const coords = {
          latitude: result[0].latitude,
          longitude: result[0].longitude,
        };

        // Cache the result
        geocodingCache.set(cacheKey, coords);

        // Limit cache size
        if (geocodingCache.size > 100) {
          const firstKey = geocodingCache.keys().next().value;
          geocodingCache.delete(firstKey);
        }

        return coords;
      }

      return null;
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError("Error al buscar la dirección");
        console.error("Geocoding error:", err);
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reverseGeocode = useCallback(
    async (coords: { latitude: number; longitude: number }) => {
      const cacheKey = `${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}`;

      // Check cache first
      if (reverseGeocodingCache.has(cacheKey)) {
        return reverseGeocodingCache.get(cacheKey);
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await Location.reverseGeocodeAsync(coords);

        if (result && result.length > 0) {
          const address = {
            street: result[0].street || "",
            streetNumber: result[0].streetNumber || "",
            city: result[0].city || "",
            region: result[0].region || "",
            postalCode: result[0].postalCode || "",
            formattedAddress:
              `${result[0].street || ""} ${result[0].streetNumber || ""}, ${result[0].city || ""}`.trim(),
          };

          // Cache the result
          reverseGeocodingCache.set(cacheKey, address);

          // Limit cache size
          if (reverseGeocodingCache.size > 100) {
            const firstKey = reverseGeocodingCache.keys().next().value;
            reverseGeocodingCache.delete(firstKey);
          }

          return address;
        }

        return null;
      } catch (err: any) {
        setError("Error al obtener la dirección");
        console.error("Reverse geocoding error:", err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const clearCache = useCallback(() => {
    geocodingCache.clear();
    reverseGeocodingCache.clear();
  }, []);

  return {
    geocode,
    reverseGeocode,
    isLoading,
    error,
    clearCache,
  };
};

// Memoization utility for expensive calculations
export const useMemoizedCalculation = <T, P extends any[]>(
  fn: (...args: P) => T,
  deps: P,
): T => {
  const memoRef = useRef<{ deps: P; result: T } | null>(null);

  if (!memoRef.current || !depsEqual(memoRef.current.deps, deps)) {
    memoRef.current = {
      deps,
      result: fn(...deps),
    };
  }

  return memoRef.current.result;
};

// Deep equality check for dependencies
const depsEqual = <T extends any[]>(a: T, b: T): boolean => {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    if (typeof a[i] === "object" && typeof b[i] === "object") {
      if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) return false;
    } else if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
};

// Performance monitoring
export const usePerformanceMonitor = (componentName: string) => {
  const renderCountRef = useRef(0);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    renderCountRef.current += 1;

    if (__DEV__) {
      const renderTime = Date.now() - startTimeRef.current;
      console.log(
        `🔍 ${componentName} - Render #${renderCountRef.current} (${renderTime}ms)`,
      );
    }

    startTimeRef.current = Date.now();
  });

  return {
    renderCount: renderCountRef.current,
  };
};
