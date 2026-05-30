// Financial Calculator - Centralized financial operations
// All monetary calculations MUST go through this service

import { financialService } from "./unifiedFinancialService";

export class FinancialCalculator {
  // Calculate order total (all values in centavos)
  static calculateOrderTotal(
    subtotal: number,
    deliveryFee: number,
    tax: number = 0,
  ): number {
    const total = subtotal + deliveryFee + tax;
    return Math.round(total);
  }

  // Validate order total
  static validateOrderTotal(
    subtotal: number,
    deliveryFee: number,
    tax: number,
    total: number,
  ): boolean {
    return financialService.validateOrderTotal(
      subtotal,
      deliveryFee,
      tax,
      total,
    );
  }

  // Calculate commission distribution
  static async calculateCommissions(
    total: number,
    deliveryFee: number = 0,
    productosBase?: number,
    nemyCommission?: number,
  ): Promise<{
    platform: number;
    business: number;
    driver: number;
  }> {
    const result = await financialService.calculateCommissions(
      total,
      deliveryFee,
      productosBase,
      nemyCommission,
    );
    return {
      platform: result.platform,
      business: result.business,
      driver: result.driver,
    };
  }

  // Convert pesos to centavos
  static pesosTocentavos(pesos: number): number {
    return financialService.pesosTocentavos(pesos);
  }

  // Convert centavos to pesos
  static centavosToPesos(centavos: number): number {
    return financialService.centavosToPesos(centavos);
  }
}
