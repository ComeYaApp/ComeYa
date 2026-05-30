import { useState, useEffect } from "react";
import NetInfo from "@react-native-community/netinfo";
import { OfflineCacheService } from "@/services/OfflineCacheService";

export function useOffline() {
  const [isOnline, setIsOnline] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    // Suscribirse a cambios de conexión
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected ?? false;

      if (online && !isOnline) {
        // Acaba de reconectar
        setIsConnecting(true);
        handleReconnect();
      }

      setIsOnline(online);
    });

    // Verificar estado inicial
    NetInfo.fetch().then((state) => {
      setIsOnline(state.isConnected ?? false);
    });

    return () => unsubscribe();
  }, [isOnline]);

  const handleReconnect = async () => {
    try {
      // Aquí se puede sincronizar la cola de acciones pendientes
      console.log("Reconectado! Sincronizando datos...");
      // await OfflineCacheService.syncQueue(apiRequest);
    } catch (error) {
      console.error("Reconnect sync error:", error);
    } finally {
      setIsConnecting(false);
    }
  };

  return {
    isOnline,
    isOffline: !isOnline,
    isConnecting,
  };
}
