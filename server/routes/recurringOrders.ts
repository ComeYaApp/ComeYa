// Pedidos programados recurrentes (semanales) — antes la app llamaba a
// POST /api/recurring-orders y no existía en el servidor (404): la
// funcionalidad era nula.
import express from "express";
import { authenticateToken } from "../authMiddleware";
import { RecurringOrdersService } from "../recurringOrdersService";

const router = express.Router();

router.post("/", authenticateToken, async (req, res) => {
  try {
    const { businessId, items, daysOfWeek, scheduledTime, notes, deliveryAddress } =
      req.body || {};
    if (!businessId || !items || !daysOfWeek) {
      return res
        .status(400)
        .json({ success: false, error: "Datos incompletos" });
    }
    const result = await RecurringOrdersService.create({
      userId: req.user!.id,
      businessId,
      items: typeof items === "string" ? items : JSON.stringify(items),
      daysOfWeek: typeof daysOfWeek === "string" ? daysOfWeek : JSON.stringify(daysOfWeek),
      scheduledTime,
      notes,
      deliveryAddress,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/", authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      recurringOrders: await RecurringOrdersService.listForUser(req.user!.id),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    res.json(await RecurringOrdersService.cancel(id, req.user!.id));
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
