import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { db } from "../db";
import { businesses } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";

const router = express.Router();

// Send verification code to business phone
router.post(
  "/send-code",
  authenticateToken,
  requireRole("business_owner"),
  async (req, res) => {
    try {
      const { businessId, phone } = req.body;

      if (!phone || !/^\+?[1-9]\d{9,14}$/.test(phone.replace(/\s/g, ""))) {
        return res.status(400).json({ error: "Número de teléfono inválido" });
      }

      const [business] = await db
        .select()
        .from(businesses)
        .where(eq(businesses.id, businessId))
        .limit(1);

      if (!business || business.ownerId !== req.user!.id) {
        return res.status(404).json({ error: "Negocio no encontrado" });
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = new Date(Date.now() + 10 * 60 * 1000);

      await db
        .update(businesses)
        .set({
          phone,
          verificationCode: code,
          verificationExpires: expires,
        })
        .where(eq(businesses.id, businessId));

      if (process.env.TWILIO_ACCOUNT_SID) {
        const twilio = require("twilio");
        const client = twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN,
        );

        await client.messages.create({
          body: `Tu código de verificación MOUZO es: ${code}`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phone,
        });
      } else {
        console.log(`[DEV] Código de verificación para ${phone}: ${code}`);
      }

      res.json({ success: true, message: "Código enviado" });
    } catch (error: any) {
      console.error("Error sending verification code:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// Verify business phone
router.post(
  "/verify-code",
  authenticateToken,
  requireRole("business_owner"),
  async (req, res) => {
    try {
      const { businessId, code } = req.body;

      const [business] = await db
        .select()
        .from(businesses)
        .where(eq(businesses.id, businessId))
        .limit(1);

      if (!business || business.ownerId !== req.user!.id) {
        return res.status(404).json({ error: "Negocio no encontrado" });
      }

      if (!business.verificationCode || !business.verificationExpires) {
        return res.status(400).json({ error: "No hay código pendiente" });
      }

      if (new Date() > business.verificationExpires) {
        return res.status(400).json({ error: "Código expirado" });
      }

      if (business.verificationCode !== code) {
        return res.status(400).json({ error: "Código incorrecto" });
      }

      await db
        .update(businesses)
        .set({
          phoneVerified: true,
          verificationCode: null,
          verificationExpires: null,
        })
        .where(eq(businesses.id, businessId));

      res.json({ success: true, message: "Teléfono verificado" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

export default router;
