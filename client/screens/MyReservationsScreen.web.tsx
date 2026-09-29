import React from "react";
import { WebLayout } from "@/components/WebLayout";
import { useResponsive } from "@/hooks/useResponsive";
import MyReservationsContent from "./MyReservationsContent";

/**
 * "Mis reservas" en web: la MISMA pantalla que la app (un solo componente,
 * `MyReservationsContent`, así que el flujo no puede divergir), con el
 * armazón de escritorio (barra superior y menú lateral) cuando hay espacio.
 * En móvil web se muestra igual que en la app, sin duplicar barras.
 */
export default function MyReservationsScreenWeb() {
  const { isMobile } = useResponsive();

  if (isMobile) return <MyReservationsContent />;

  return (
    <WebLayout>
      <MyReservationsContent />
    </WebLayout>
  );
}
