import React from "react";
import { WebLayout } from "@/components/WebLayout";
import { useResponsive } from "@/hooks/useResponsive";
import BusinessFinancesContent from "./BusinessFinancesContent";

/**
 * Historial de pagos / finanzas del negocio en web: la MISMA pantalla que la
 * app (un solo componente, `BusinessFinancesContent`), con el armazón de
 * escritorio cuando hay espacio.
 */
export default function BusinessFinancesScreenWeb() {
  const { isMobile } = useResponsive();

  if (isMobile) return <BusinessFinancesContent />;

  return (
    <WebLayout>
      <BusinessFinancesContent />
    </WebLayout>
  );
}
