import express from "express";

const router = express.Router();

/**
 * GET /api/app-config
 * Endpoint público — expone configuraciones del admin panel para el cliente.
 * Los valores se sincronizan desde el panel de admin (SystemConfigScreen).
 * Mientras la tabla no exista, devuelve defaults de Soria.
 */
router.get("/", async (_req, res) => {
  // Valores por defecto para Soria
  // Cuando se implemente la tabla system_config, estos valores se cargarán de BD
  res.json({
    success: true,
    commission: {
      platformPercent: 15,
      totalPercent: 15,
    },
    pricing: {
      minimumOrder: 5,
      serviceFee: 1,
    },
    deliveryFees: {
      tier1: 2.5,
      tier2: 4.0,
      tier3: 5.0,
      extraPerKm: 1.0,
    },
    deliveryZone: {
      name: "Soria",
      radius: 8,
      baseFee: 2.5,
      active: true,
    },
    features: {
      cashPayments: true,
      biometricAuth: false,
      aiSupport: false,
      realTimeTracking: true,
    },
  });
});

export default router;
