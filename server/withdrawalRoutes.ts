import { Router } from "express";
import { withdrawalService } from "./withdrawalService";
import { db } from "./db";
import { withdrawalRequests } from "../shared/schema-mysql";
import { eq } from "drizzle-orm";

const router = Router();

// Solicitar retiro
router.post("/request", async (req, res) => {
  try {
    const { userId, amount, method, bankAccount } = req.body;

    if (!userId || !amount || !method) {
      return res.status(400).json({ error: "Faltan datos requeridos" });
    }

    if (amount < 5000) {
      return res
        .status(400)
        .json({ error: "El monto mínimo de retiro es $50 MXN" });
    }

    if (method === "bank_transfer" && !bankAccount) {
      return res
        .status(400)
        .json({ error: "Debes proporcionar datos bancarios" });
    }

    const result = await withdrawalService.requestWithdrawal({
      userId,
      amount,
      method,
      bankAccount,
    });

    res.json(result);
  } catch (error: any) {
    console.error("Error requesting withdrawal:", error);
    res.status(400).json({ error: error.message });
  }
});

// Historial de retiros
router.get("/history/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const history = await withdrawalService.getWithdrawalHistory(userId);
    res.json(history);
  } catch (error: any) {
    console.error("Error fetching withdrawal history:", error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Listar retiros pendientes
router.get("/admin/pending", async (req, res) => {
  try {
    const pending = await db.query.withdrawalRequests.findMany({
      where: eq(withdrawalRequests.status, "pending"),
      orderBy: (requests, { asc }) => [asc(requests.requestedAt)],
    });

    res.json(pending);
  } catch (error: any) {
    console.error("Error fetching pending withdrawals:", error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Aprobar retiro
router.post("/admin/approve/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;

    if (!adminId) {
      return res.status(400).json({ error: "Se requiere ID de administrador" });
    }

    const result = await withdrawalService.approveWithdrawal(id, adminId);
    res.json(result);
  } catch (error: any) {
    console.error("Error approving withdrawal:", error);
    res.status(400).json({ error: error.message });
  }
});

export default router;
