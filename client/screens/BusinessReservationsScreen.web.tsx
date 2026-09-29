import React from "react";
import { WebLayout } from "@/components/WebLayout";
import { useResponsive } from "@/hooks/useResponsive";
import BusinessReservationsContent from "./BusinessReservationsContent";

/**
 * Agenda de reservas del negocio en web: la MISMA pantalla que la app (un
 * solo componente, `BusinessReservationsContent`), con el armazón de
 * escritorio (barra superior y menú lateral) cuando hay espacio. En móvil web
 * se muestra igual que en la app.
 */
export default function BusinessReservationsScreenWeb() {
  const { isMobile } = useResponsive();

  if (isMobile) return <BusinessReservationsContent />;

  return (
    <WebLayout>
      <BusinessReservationsContent />
    </WebLayout>
  );
}
