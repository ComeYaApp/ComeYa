import express from "express";
import { authenticateToken } from "../authMiddleware";
import { db } from "../db";
import { users, paymentAccounts } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";

const router = express.Router();

// Obtener cuenta bancaria del usuario (IBAN/CLABE)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const [user] = await db
      .select({ bankAccount: users.bankAccount })
      .from(users)
      .where(eq(users.id, req.user!.id))
      .limit(1);

    let bankAccount = null;
    if (user?.bankAccount) {
      try {
        bankAccount = JSON.parse(user.bankAccount as string);
      } catch {
        bankAccount = user.bankAccount;
      }
    }

    // Respaldo: cuenta guardada en payment_accounts (Métodos de pago)
    if (!bankAccount) {
      try {
        const accounts = await db
          .select()
          .from(paymentAccounts)
          .where(eq(paymentAccounts.userId, req.user!.id));
        const account =
          accounts.find((a: any) => a.isDefault) || accounts[0];
        if (account) {
          const numero = account.binanceId || account.pagoMovilPhone || "";
          bankAccount = {
            iban: account.method === "transferencia" ? numero : null,
            clabe: account.method === "transferencia" ? null : numero,
            bankName:
              account.method === "paypal"
                ? "PayPal"
                : account.zelleEmail || "Transferencia SEPA",
            accountHolder: account.zelleEmail || "",
          };
        }
      } catch {
        /* sin cuenta en payment_accounts */
      }
    }

    res.json({ success: true, bankAccount });
  } catch (error: any) {
    console.error("Error loading bank account:", error);
    res.status(500).json({ error: "Error al cargar la cuenta bancaria" });
  }
});

// Guardar/actualizar cuenta bancaria (IBAN español o CLABE)
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { iban, clabe, bankName, accountHolder } = req.body || {};

    const numero = `${iban || clabe || ""}`.trim().replace(/\s+/g, "");
    if (numero.length !== 24 && numero.length !== 18) {
      return res
        .status(400)
        .json({ error: "IBAN (24 caracteres) o CLABE (18 dígitos) requerido" });
    }
    if (!bankName || !accountHolder) {
      return res.status(400).json({ error: "Banco y titular son requeridos" });
    }

    const bankAccount = {
      iban: numero.length === 24 ? numero : null,
      clabe: numero.length === 18 ? numero : null,
      bankName: `${bankName}`.trim(),
      accountHolder: `${accountHolder}`.trim(),
    };

    await db
      .update(users)
      .set({ bankAccount: JSON.stringify(bankAccount) })
      .where(eq(users.id, req.user!.id));

    // Mantener también payment_accounts para el flujo de retiros
    try {
      await db.insert(paymentAccounts).values({
        id: crypto.randomUUID(),
        userId: req.user!.id,
        method: "transferencia",
        isDefault: true,
        binanceId: numero,
        zelleEmail: `${accountHolder}`.trim(),
        label: `${bankName}`.trim(),
      });
    } catch {
      /* opcional */
    }

    res.json({ success: true, bankAccount });
  } catch (error: any) {
    console.error("Error saving bank account:", error);
    res.status(500).json({ error: "Error al guardar la cuenta bancaria" });
  }
});

export default router;
