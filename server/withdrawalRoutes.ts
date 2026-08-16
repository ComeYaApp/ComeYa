import { Router } from "express";
import { withdrawalService } from "./withdrawalService";
import { db } from "./db";
import { withdrawalRequests } from "../shared/schema-mysql";
import { eq } from "drizzle-orm";
import { authenticateToken, requireRole } from "./authMiddleware";

const router = Router();

// Solicitar retiro (usuario autenticado; solo para sí mismo)
router.post("/request", authenticateToken, async (req, res) => {
  try {
    const { userId, amount, method, bankAccount } = req.body;

    if (!userId || !amount || !method) {
      return res.status(400).json({ error: "Faltan datos requeridos" });
    }

    // Un usuario solo puede retirar a su propia cuenta
    const isStaff =
      (req as any).user?.role === "admin" ||
      (req as any).user?.role === "super_admin";
    if (!isStaff && userId !== (req as any).user?.id) {
      return res.status(403).json({ error: "No autorizado" });
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

// Historial de retiros (propietario o admin)
router.get(
  "/history/:userId",
  authenticateToken,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const role = (req as any).user?.role;
      if (userId !== (req as any).user?.id && role !== "admin" && role !== "super_admin") {
        return res.status(403).json({ error: "No autorizado" });
      }
      const history = await withdrawalService.getWithdrawalHistory(userId);
      res.json(history);
    } catch (error: any) {
      console.error("Error fetching withdrawal history:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// Admin: Listar retiros pendientes
router.get(
  "/admin/pending",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      // select directo (withdrawalRequests es alias de payouts en el schema)
      const pending = await db
        .select()
        .from(withdrawalRequests)
        .where(eq(withdrawalRequests.status, "pending"))
        .orderBy(withdrawalRequests.createdAt);

      res.json(pending);
    } catch (error: any) {
      console.error("Error fetching pending withdrawals:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// Admin: Aprobar retiro
router.post(
  "/admin/approve/:id",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const adminId = (req as any).user?.id || req.body?.adminId;

      if (!adminId) {
        return res.status(400).json({ error: "Se requiere ID de administrador" });
      }

      const result = await withdrawalService.approveWithdrawal(id, adminId);
      res.json(result);
    } catch (error: any) {
      console.error("Error approving withdrawal:", error);
      res.status(400).json({ error: error.message });
    }
  },
);

export default router;
