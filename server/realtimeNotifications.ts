import { db } from "./db";
import { businesses, products } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export async function notifySaturatedMode(
  businessId: string,
  isSlammed: boolean,
) {
  try {
    await db
      .update(businesses)
      .set({
        isSlammed,
        updatedAt: new Date(),
      })
      .where(eq(businesses.id, businessId));

    logger.info("Saturated mode updated", { businessId, isSlammed });
    return {
      success: true,
      message: isSlammed
        ? "Modo saturado activado"
        : "Modo saturado desactivado",
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function notifyMenu86(productId: string, isOutOfStock: boolean) {
  try {
    await db
      .update(products)
      .set({
        isAvailable: !isOutOfStock,
        updatedAt: new Date(),
      })
      .where(eq(products.id, productId));

    logger.info("Menu 86 updated", { productId, isOutOfStock });
    return {
      success: true,
      message: isOutOfStock
        ? "Producto marcado como agotado"
        : "Producto disponible nuevamente",
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function bulkMenu86(
  businessId: string,
  productIds: string[],
  isOutOfStock: boolean,
) {
  try {
    for (const productId of productIds) {
      await db
        .update(products)
        .set({
          isAvailable: !isOutOfStock,
        })
        .where(eq(products.id, productId));
    }

    logger.info("Bulk Menu 86 updated", {
      businessId,
      count: productIds.length,
      isOutOfStock,
    });
    return { success: true, updated: productIds.length };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
