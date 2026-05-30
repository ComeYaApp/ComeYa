// Nuevo sistema de comisiones simplificado
export class NewCommissionService {
  private static async getCommissionRate(): Promise<number> {
    try {
      const { db } = await import("./db");
      const { systemSettings } = await import("../shared/schema-mysql");
      const { eq } = await import("drizzle-orm");
      const [row] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, "comeya_commission"))
        .limit(1);
      if (row?.value) return parseFloat(row.value) / 100;
    } catch {}
    return 0.15; // fallback
  }

  static async calculateCommissions(subtotal: number, deliveryFee: number) {
    const rate = await this.getCommissionRate();
    const productAmount = subtotal;
    const comeyaCommission = Math.round(productAmount * rate);

    return {
      business: productAmount,
      driver: deliveryFee,
      comeya: comeyaCommission,
      total: productAmount + deliveryFee + comeyaCommission,
      productBase: productAmount,
      deliveryBase: deliveryFee,
    };
  }

  static async calculateCustomerTotal(subtotal: number, deliveryFee: number) {
    const commissions = await this.calculateCommissions(subtotal, deliveryFee);
    return commissions.total;
  }
}
