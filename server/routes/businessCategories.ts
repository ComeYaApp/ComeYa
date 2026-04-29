import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";

const router = express.Router();

// Seed de categorías por defecto si la tabla está vacía
const DEFAULT_CATEGORIES = [
  { name: "Restaurantes",  slug: "restaurant", icon: "coffee",       color: "#F97316", description: "Comida preparada, menús y platos del día",          displayOrder: 1 },
  { name: "Mercados",      slug: "market",     icon: "shopping-bag", color: "#10B981", description: "Supermercados, fruterías y alimentación",           displayOrder: 2 },
  { name: "Farmacias",     slug: "pharmacy",   icon: "plus-circle",  color: "#3B82F6", description: "Medicamentos, parafarmacia y productos de salud",   displayOrder: 3 },
  { name: "Tiendas",       slug: "store",      icon: "package",      color: "#8B5CF6", description: "Comercios locales y tiendas especializadas",        displayOrder: 4 },
  { name: "Ferreterías",   slug: "hardware",   icon: "tool",         color: "#F59E0B", description: "Herramientas, materiales y bricolaje",              displayOrder: 5 },
  { name: "Papelerías",    slug: "stationery", icon: "book",         color: "#EC4899", description: "Material de oficina, libros y papelería",           displayOrder: 6 },
  { name: "Otros",         slug: "other",      icon: "grid",         color: "#6B7280", description: "Negocios que no encajan en otras categorías",       displayOrder: 99 },
];

// GET /api/admin/business-categories — listar todas
router.get("/", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { businessCategories } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { asc } = await import("drizzle-orm");

    let cats = await db.select().from(businessCategories).orderBy(asc(businessCategories.displayOrder));

    // Auto-seed si está vacía
    if (cats.length === 0) {
      await db.insert(businessCategories).values(DEFAULT_CATEGORIES as any);
      cats = await db.select().from(businessCategories).orderBy(asc(businessCategories.displayOrder));
    }

    res.json({ success: true, categories: cats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/business-categories/public — público para el checkout/registro
router.get("/public", async (_req, res) => {
  try {
    const { businessCategories } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { asc, eq } = await import("drizzle-orm");

    const cats = await db.select().from(businessCategories)
      .where(eq(businessCategories.isActive, true))
      .orderBy(asc(businessCategories.displayOrder));

    res.json({ success: true, categories: cats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/business-categories — crear
router.post("/", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { businessCategories } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const { name, slug, icon, color, description, isActive, displayOrder } = req.body;

    if (!name?.trim() || !slug?.trim()) {
      return res.status(400).json({ success: false, error: "name y slug son requeridos" });
    }

    const cleanSlug = slug.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    await db.insert(businessCategories).values({
      name:         name.trim(),
      slug:         cleanSlug,
      icon:         icon         ?? "grid",
      color:        color        ?? "#6B7280",
      description:  description  ?? null,
      isActive:     isActive     ?? true,
      displayOrder: displayOrder ?? 0,
    });

    const [created] = await db.select().from(businessCategories)
      .where((await import("drizzle-orm")).eq(businessCategories.slug, cleanSlug)).limit(1);

    res.json({ success: true, category: created });
  } catch (error: any) {
    if (error.message?.includes("Duplicate")) {
      return res.status(409).json({ success: false, error: "Ya existe una categoría con ese slug" });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/admin/business-categories/:id — editar
router.put("/:id", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { businessCategories } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq } = await import("drizzle-orm");

    const { name, slug, icon, color, description, isActive, displayOrder } = req.body;

    const updates: any = {};
    if (name         !== undefined) updates.name         = name.trim();
    if (slug         !== undefined) updates.slug         = slug.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (icon         !== undefined) updates.icon         = icon;
    if (color        !== undefined) updates.color        = color;
    if (description  !== undefined) updates.description  = description;
    if (isActive     !== undefined) updates.isActive     = isActive;
    if (displayOrder !== undefined) updates.displayOrder = displayOrder;

    await db.update(businessCategories).set(updates).where(eq(businessCategories.id, req.params.id));

    const [updated] = await db.select().from(businessCategories)
      .where(eq(businessCategories.id, req.params.id)).limit(1);

    res.json({ success: true, category: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/admin/business-categories/:id — eliminar
router.delete("/:id", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { businessCategories } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq } = await import("drizzle-orm");

    await db.delete(businessCategories).where(eq(businessCategories.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
