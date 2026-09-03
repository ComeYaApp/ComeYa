import React, { useEffect, useRef, useState } from "react";
import { Marker, AnimatedRegion } from "react-native-maps";
import type { MapMarkerProps } from "react-native-maps";

/** Haversine en metros (local: evita dependencias entre componentes). */
function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

interface SmartMarkerProps extends MapMarkerProps {
  children?: React.ReactNode;
  /**
   * Cambia cuando cambia el contenido visual del marcador (icono, foto,
   * rumbo…). Al cambiar, se re-renderiza la vista y se vuelve a congelar.
   * IMPORTANTE: si el contenido incluye la rotación por heading, el trackKey
   * debe incluir el heading (redondeado) o Android congela la flecha en el
   * primer ángulo y "no gira nunca".
   */
  trackKey?: string | number;
}

/**
 * Marker que gestiona `tracksViewChanges` correctamente:
 * Android congela la vista del marcador tras el primer render; sin esto,
 * las vistas personalizadas aparecen como cajas blancas vacías.
 *
 * Además interpola la posición con AnimatedRegion: en vez de saltar de un
 * fix al siguiente, desliza el marcador durante ~0,9 s (fix/WS cada 1-2 s);
 * los saltos grandes (reroute, reconexión) no se animan. Coste: 0 llamadas.
 */
export function SmartMarker({
  trackKey = "",
  coordinate,
  children,
  ...rest
}: SmartMarkerProps) {
  const [tracks, setTracks] = useState(true);
  const coord = coordinate as { latitude: number; longitude: number };
  const lastCoordRef = useRef<{ latitude: number; longitude: number } | null>(
    null,
  );

  const regionRef = useRef<AnimatedRegion | null>(null);
  if (
    coord &&
    Number.isFinite(coord.latitude) &&
    Number.isFinite(coord.longitude) &&
    !regionRef.current
  ) {
    regionRef.current = new AnimatedRegion({
      latitude: coord.latitude,
      longitude: coord.longitude,
      latitudeDelta: 0,
      longitudeDelta: 0,
    });
    lastCoordRef.current = coord;
  }

  // Animar hacia la nueva posición (primer render no anima: ya nació ahí).
  // 900 ms: con fixes cada 1-2 s el marcador va pegado al centro de cámara
  // (con 1.900 ms se reiniciaba antes de terminar y quedaba por detrás).
  useEffect(() => {
    const region = regionRef.current;
    if (
      !region ||
      !coord ||
      !Number.isFinite(coord.latitude) ||
      !Number.isFinite(coord.longitude)
    )
      return;
    const prev = lastCoordRef.current;
    lastCoordRef.current = coord;
    const movedM = prev ? distanceMeters(prev, coord) : 0;
    // Nota: el typing de AnimatedRegion.timing exige toValue (bug de tipos
    // de react-native-maps); el patrón oficial de la librería no lo pasa.
    region
      .timing({
        latitude: coord.latitude,
        longitude: coord.longitude,
        duration: movedM > 100 ? 0 : 900,
      } as any)
      .start();
  }, [coord?.latitude, coord?.longitude]);

  useEffect(() => {
    setTracks(true);
    const t = setTimeout(() => setTracks(false), 200);
    return () => clearTimeout(t);
  }, [trackKey]);

  if (!regionRef.current) {
    return null;
  }

  return (
    <Marker.Animated
      {...rest}
      coordinate={regionRef.current as any}
      tracksViewChanges={tracks}
    >
      {children}
    </Marker.Animated>
  );
}
