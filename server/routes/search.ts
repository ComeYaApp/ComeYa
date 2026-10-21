import express from "express";
import { db } from "../db";
import { products, businesses } from "@shared/schema-mysql";
import { like, and, eq, or } from "drizzle-orm";

const router = express.Router();

// GET /api/search/products?q=arroz con pollo
router.get("/products", async (req, res) => {
  try {
    const query = ((req.query.q as string) || "").trim();

    if (!query || query.length < 2) {
      return res.json({ success: true, results: [] });
    }

    const searchTerms = query
      .toLowerCase()
      .split(" ")
      .filter((t) => t.length > 1);

    // Buscar productos que coincidan con cualquier término
    const results = await db
      .select({
        product: products,
        business: {
          id: businesses.id,
          name: businesses.name,
          image: businesses.image,
          isOpen: businesses.isOpen,
          deliveryFee: businesses.deliveryFee,
        },
      })
      .from(products)
      .leftJoin(businesses, eq(products.businessId, businesses.id))
      .where(
        and(
          eq(products.isAvailable, true),
          eq(businesses.isActive, true),
          or(
            ...searchTerms.map((term) => like(products.name, `%${term}%`)),
            ...searchTerms.map((term) =>
              like(products.description, `%${term}%`),
            ),
          ),
        ),
      )
      .limit(50);

    // Precio cliente: base + markup + comisión del negocio (memoizada por
    // negocio). `price` se mantiene para la app antigua.
    const { createRateResolver, addCustomerPrice } = await import(
      "../utils/productPricing"
    );
    const { getPricingConfig } = await import("../pricingService");
    const pricing = await getPricingConfig();
    const resolveRate = createRateResolver();
    const mapped = await Promise.all(
      results.map(async (r) => {
        const ratePct = r.business?.id
          ? await resolveRate(String(r.business.id))
          : pricing.commissionPct;
        return {
          ...addCustomerPrice(
            r.product as any,
            pricing.markupPct,
            ratePct,
          ),
          business: r.business,
        };
      }),
    );

    res.json({ success: true, results: mapped });
  } catch (error: any) {
    console.error("Product search error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
