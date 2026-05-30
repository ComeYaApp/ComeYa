import { Request, Response, NextFunction } from "express";
import { FinancialIntegrity } from "./financialIntegrity";
import { financialService } from "./unifiedFinancialService";

// Validar financials de pedido antes de crear
export async function validateOrderFinancials(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const {
      subtotal,
      deliveryFee,
      total,
      productosBase,
      nemyCommission,
      couponDiscount,
    } = req.body;

    // Validar que los campos existan
    if (
      subtotal === undefined ||
      deliveryFee === undefined ||
      total === undefined
    ) {
      return res.status(400).json({
        error: "Campos financieros requeridos: subtotal, deliveryFee, total",
      });
    }

    // Validar que sean números positivos
    if (subtotal < 0 || deliveryFee < 0 || total < 0) {
      return res.status(400).json({
        error: "Los montos deben ser positivos",
      });
    }

    // Validar total: subtotal (base) + comision (15%) + deliveryFee - descuento
    const baseSubtotal = productosBase ?? subtotal;
    const platformCommission =
      typeof nemyCommission === "number" && nemyCommission > 0
        ? nemyCommission
        : Math.round(baseSubtotal * 0.15);
    const discount = couponDiscount || 0;
    const calculatedTotal =
      baseSubtotal + platformCommission + deliveryFee - discount;

    // Permitir diferencia de 1 centavo por redondeo
    if (Math.abs(calculatedTotal - total) > 1) {
      return res.status(400).json({
        error: "Total inválido",
        expected: calculatedTotal,
        received: total,
        breakdown: { baseSubtotal, platformCommission, deliveryFee, discount },
      });
    }

    next();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// Validar comisiones del sistema (solo super_admin)
export async function validateCommissionRates(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { platform, business, driver } = req.body;

    if (
      platform === undefined ||
      business === undefined ||
      driver === undefined
    ) {
      return res.status(400).json({
        error: "Campos requeridos: platform, business, driver",
      });
    }

    // Validar que sean números entre 0 y 1
    if (
      platform < 0 ||
      platform > 1 ||
      business < 0 ||
      business > 1 ||
      driver < 0 ||
      driver > 1
    ) {
      return res.status(400).json({
        error: "Las comisiones deben estar entre 0 y 1 (0% y 100%)",
      });
    }

    // Validar que sumen 1.0 (100%)
    const total = platform + business + driver;
    if (Math.abs(total - 1.0) > 0.001) {
      return res.status(400).json({
        error: "Las comisiones deben sumar exactamente 100%",
        current: `${(total * 100).toFixed(2)}%`,
        breakdown: {
          platform: `${(platform * 100).toFixed(2)}%`,
          business: `${(business * 100).toFixed(2)}%`,
          driver: `${(driver * 100).toFixed(2)}%`,
        },
      });
    }

    next();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// Validar retiro de wallet
export async function validateWithdrawal(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { amount } = req.body;
    const userId = req.user!.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        error: "Monto de retiro inválido",
      });
    }

    // Validar transacción
    const validation = await FinancialIntegrity.validateWalletTransaction(
      userId,
      -amount, // Negativo para retiro
      "withdrawal",
    );

    if (!validation.valid) {
      return res.status(400).json({
        error: validation.error,
        details: validation.details,
      });
    }

    next();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// Validar que el pedido tenga integridad financiera antes de completar
export async function validateOrderCompletion(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const paramId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;
    const paramOrderId = Array.isArray(req.params.orderId)
      ? req.params.orderId[0]
      : req.params.orderId;
    const orderId = paramId || paramOrderId;

    const validation = await FinancialIntegrity.reconcileOrder(orderId);

    if (!validation.valid) {
      if (
        validation.error === "Comisiones no suman el total del pedido" ||
        validation.error === "Pedido entregado sin comisiones calculadas"
      ) {
        return next();
      }

      return res.status(400).json({
        error: "El pedido tiene problemas de integridad financiera",
        details: validation.error,
      });
    }

    next();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// Calcular y agregar comisiones al request
export async function calculateCommissions(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { total, deliveryFee = 0, productosBase, nemyCommission } = req.body;

    if (!total) {
      return res.status(400).json({
        error: "Total requerido para calcular comisiones",
      });
    }

    const commissions = await financialService.calculateCommissions(
      total,
      deliveryFee || 0,
      productosBase || undefined,
      nemyCommission || undefined,
    );

    // Agregar comisiones al body para uso posterior
    req.body.platformFee = commissions.platform;
    req.body.businessEarnings = commissions.business;
    req.body.deliveryEarnings = commissions.driver;

    next();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
