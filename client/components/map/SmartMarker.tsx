import React, { useEffect, useRef, useState } from "react";
import { Marker, AnimatedRegion } from "react-native-maps";
import type { MapMarkerProps } from "react-native-maps";


interface SmartMarkerProps extends MapMarkerProps {
  children?: React.ReactNode;
  /**
   * Cambia cuando cambia el contenido visual del marcador (icono, foto, texto).
   * Al cambiar, se re-renderiza la vista y se vuelve a congelar.
   */
  trackKey?: string | number;
}

/**
 * Marker que gestiona `tracksViewChanges` correctamente:
 * Android congela la vista del marcador tras el primer render; sin esto,
 * las vistas personalizadas aparecen como cajas blancas vacías.
 *
 * Además interpola la posición con AnimatedRegion: en vez de saltar de un
 * fix GPS al siguiente, desliza el marcador durante ~1,9 s (el websocket
 * emite cada 2 s). Coste: 0 llamadas de red.
 */
export function SmartMarker({
  trackKey = "",
  coordinate,
  children,
  ...rest
}: SmartMarkerProps) {
  const [tracks, setTracks] = useState(true);
  const coord = coordinate as { latitude: number; longitude: number };

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
  }

  // Animar hacia la nueva posición (primer render no anima: ya nació ahí)
  useEffect(() => {
    const region = regionRef.current;
    if (
      !region ||
      !coord ||
      !Number.isFinite(coord.latitude) ||
      !Number.isFinite(coord.longitude)
    )
      return;
    // Nota: el typing de AnimatedRegion.timing exige toValue (bug de tipos
    // de react-native-maps); el patrón oficial de la librería no lo pasa.
    region
      .timing({
        latitude: coord.latitude,
        longitude: coord.longitude,
        duration: 1900,
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
