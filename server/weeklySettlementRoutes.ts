import { Router } from "express";
import { authenticateToken } from "./authMiddleware";
import { WeeklySettlementService } from "./weeklySettlementService";
import { db } from "./db";
import { sql } from "drizzle-orm";

const router = Router();

// Driver: Ver su liquidación pendiente
router.get("/driver/pending", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const settlement =
      await WeeklySettlementService.getDriverPendingSettlement(userId);

    // Obtener cuenta bancaria de la plataforma
    const bankResult = await db.execute(sql`
      SELECT * FROM platform_bank_account WHERE is_active = 1 LIMIT 1
    `);

    const bankRows = Array.isArray(bankResult)
      ? Array.isArray(bankResult[0])
        ? bankResult[0]
        : bankResult
      : bankResult?.rows || [];

    res.json({
      success: true,
      settlement,
      bankAccount: bankRows[0] || null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Driver: Subir comprobante de pago
router.post("/driver/submit-proof", authenticateToken, async (req, res) => {
  try {
    const { settlementId, proofUrl } = req.body;

    await WeeklySettlementService.submitPaymentProof(settlementId, proofUrl);

    res.json({ success: true, message: "Comprobante enviado" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Ver todas las liquidaciones pendientes
router.get("/admin/pending", authenticateToken, async (req, res) => {
  try {
    const settlements =
      await WeeklySettlementService.getAllPendingSettlements();

    res.json({ success: true, settlements });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Aprobar liquidación
router.post("/admin/approve/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).user.id;

    await WeeklySettlementService.approveSettlement(id, adminId);

    res.json({ success: true, message: "Liquidación aprobada" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Rechazar liquidación
router.post("/admin/reject/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const adminId = (req as any).user.id;

    await WeeklySettlementService.rejectSettlement(id, adminId, notes);

    res.json({ success: true, message: "Liquidación rechazada" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Configurar cuenta bancaria
router.post("/admin/bank-account", authenticateToken, async (req, res) => {
  try {
    const { bankName, accountHolder, clabe, accountNumber, notes } = req.body;

    // Desactivar cuentas anteriores
    await db.execute(sql`UPDATE platform_bank_account SET is_active = 0`);

    // Crear nueva cuenta
    await db.execute(sql`
      INSERT INTO platform_bank_account 
      (bank_name, account_holder, clabe, account_number, notes, is_active)
      VALUES (${bankName}, ${accountHolder}, ${clabe}, ${accountNumber || ""}, ${notes || ""}, 1)
    `);

    res.json({ success: true, message: "Cuenta bancaria configurada" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Obtener cuenta bancaria activa
router.get("/admin/bank-account", authenticateToken, async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT * FROM platform_bank_account WHERE is_active = 1 LIMIT 1
    `);

    const rows = Array.isArray(result)
      ? Array.isArray(result[0])
        ? result[0]
        : result
      : result?.rows || [];

    res.json({ success: true, bankAccount: rows[0] || null });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Cron: Cerrar semana (llamar cada viernes 11:59 PM)
router.post("/cron/close-week", async (req, res) => {
  try {
    const result = await WeeklySettlementService.closeWeek();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Cron: Bloquear drivers (llamar cada lunes 12:00 AM)
router.post("/cron/block-unpaid", async (req, res) => {
  try {
    const result = await WeeklySettlementService.blockUnpaidDrivers();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
