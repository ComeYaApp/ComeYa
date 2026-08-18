import React, { useEffect, useState } from "react";
import { Marker } from "react-native-maps";
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
 */
export function SmartMarker({
  trackKey = "",
  children,
  ...rest
}: SmartMarkerProps) {
  const [tracks, setTracks] = useState(true);

  useEffect(() => {
    setTracks(true);
    const t = setTimeout(() => setTracks(false), 200);
    return () => clearTimeout(t);
  }, [trackKey]);

  return (
    <Marker {...rest} tracksViewChanges={tracks}>
      {children}
    </Marker>
  );
}
