import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/query-client";

/**
 * Métricas del panel admin compartidas entre la barra de pestañas y el menú
 * Admin. Se refrescan automáticamente para que los badges no queden obsoletos
 * (antes solo se cargaban una vez al montar el panel web).
 */
export function useAdminMetrics(enabled = true, intervalMs = 30_000) {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const hasLoaded = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    if (!hasLoaded.current) setLoading(true);
    try {
      const res = await apiRequest("GET", "/api/admin/dashboard/metrics");
      const data = await res.json();
      if (data) setMetrics(data);
    } catch {
      // Se conserva la última lectura buena.
    } finally {
      hasLoaded.current = true;
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const timer = setInterval(refresh, intervalMs);
    return () => clearInterval(timer);
  }, [enabled, intervalMs, refresh]);

  return { metrics, loading, refresh };
}
