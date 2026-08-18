import { Router } from "express";
import { authenticateToken } from "../authMiddleware";
import { ReferralService } from "../referralService";

const router = Router();

// GET /api/referrals/my-code — código de referido del usuario actual
router.get("/my-code", authenticateToken, async (req, res) => {
  try {
    const referralCode = await ReferralService.getOrCreateReferralCode(
      req.user!.id,
    );
    res.json({
      success: true,
      referralCode,
      shareLink: `https://app.comeya.es?ref=${referralCode}`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/referrals/summary — resumen para la pantalla "Invita y Gana"
router.get("/summary", authenticateToken, async (req, res) => {
  try {
    const summary = await ReferralService.getReferralSummary(req.user!.id);
    res.json({ success: true, ...summary });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
