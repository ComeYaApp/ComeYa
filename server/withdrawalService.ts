import { db } from "./db";
import { wallets, payouts, users, paymentAccounts } from "../shared/schema-mysql";
import { eq, and, desc } from "drizzle-orm";

const MINIMUM_WITHDRAWAL = 5000; // 50 € en céntimos

export interface WithdrawalRequest {
  userId: string;
  amount: number;
  method?: "pago_movil" | "bank_transfer";
  pagoMovilPhone?: string;
  pagoMovilBank?: string;
  pagoMovilCedula?: string;
  bankAccount?: {
    accountNumber: string;
    bankName: string;
    accountHolder: string;
    accountType: string;
  };
}

// Payouts de tipo retiro: order_id autogenerado con prefijo wdr- para
// distinguirlos de los payouts de pedido
const WITHDRAWAL_ORDER_PREFIX = "wdr-";

export class WithdrawalService {
  async requestWithdrawal(request: WithdrawalRequest) {
    // 1. Validar usando unifiedFinancialService
    const { financialService } = await import("./unifiedFinancialService");

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, request.userId))
      .limit(1);

    if (!user) {
      throw new Error("Usuario no encontrado");
    }

    const canWithdraw = await financialService.canUserWithdraw(
      request.userId,
      user.role,
    );
    if (!canWithdraw.allowed) {
      throw new Error(canWithdraw.reason || "No puedes retirar en este momento");
    }

    if (request.amount < MINIMUM_WITHDRAWAL) {
      throw new Error("El monto mínimo de retiro es 50 €");
    }

    const wallet = await financialService.getWallet(request.userId);
    const availableBalance = wallet.balance - (wallet.cashOwed || 0);

    if (request.amount > availableBalance) {
      throw new Error("Saldo insuficiente");
    }

    // Si no vienen datos bancarios, usar la cuenta de pago guardada del
    // usuario (configurada en Métodos de pago — Bizum/IBAN/PayPal)
    let bankAccount = request.bankAccount;
    let pagoMovilPhone = request.pagoMovilPhone;
    if (!bankAccount && !pagoMovilPhone) {
      const accounts = await db
        .select()
        .from(paymentAccounts)
        .where(eq(paymentAccounts.userId, request.userId));
      const account =
        accounts.find((a: any) => a.isDefault) || accounts[0];
      if (!account) {
        throw new Error(
          "Configura primero tu cuenta de pago en tu perfil (Métodos de pago)",
        );
      }
      if (account.method === "bizum" && account.pagoMovilPhone) {
        pagoMovilPhone = account.pagoMovilPhone;
      } else {
        bankAccount = {
          accountNumber:
            account.binanceId || account.zelleEmail || account.zinliEmail || "",
          bankName:
            account.method === "paypal"
              ? "PayPal"
              : account.method === "bizum"
                ? "Bizum"
                : "Transferencia SEPA",
          accountHolder: account.zelleEmail || "",
          accountType: account.method,
        };
      }
    }

    const snapshot = bankAccount
      ? JSON.stringify(bankAccount)
      : JSON.stringify({ pagoMovilPhone: pagoMovilPhone || null });

    // 2. Crear la solicitud como payout pendiente (el admin la aprueba)
    const payoutId = crypto.randomUUID();
    await db.insert(payouts).values({
      id: payoutId,
      orderId: `${WITHDRAWAL_ORDER_PREFIX}${payoutId}`,
      recipientId: request.userId,
      recipientType: user.role === "business_owner" ? "business" : "driver",
      amount: request.amount,
      method: request.method || "bank_transfer",
      accountSnapshot: snapshot,
      status: "pending",
      notes: JSON.stringify({ type: "withdrawal" }),
    });

    // 3. Retener el saldo mientras el admin aprueba (evita retiros dobles)
    await db
      .update(wallets)
      .set({
        balance: Math.max(0, wallet.balance - request.amount),
        pendingBalance: (wallet.pendingBalance || 0) + request.amount,
      })
      .where(eq(wallets.userId, request.userId));

    // 4. Notificar a los administradores
    try {
      const { notifyAdmins } = await import("./websocket");
      notifyAdmins({
        type: "new_withdrawal",
        payoutId,
        userId: request.userId,
        amount: request.amount,
        message: "Nueva solicitud de retiro pendiente de aprobación",
      });
      const { sendPushToUser } = await import("./enhancedPushService");
      const pendingAdmins = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, "admin"));
      for (const admin of pendingAdmins) {
        await sendPushToUser(admin.id, {
          title: "💰 Retiro pendiente",
          body: `Un usuario solicitó retirar ${(request.amount / 100).toFixed(2)} €. Revisa Finanzas.`,
          data: { screen: "AdminFinance" },
        });
      }
    } catch (notifyError) {
      console.error("Error notifying admins of withdrawal:", notifyError);
    }

    return {
      success: true,
      id: payoutId,
      status: "pending",
      message: "Solicitud enviada. El admin la aprobará pronto.",
    };
  }

  async getWithdrawalHistory(userId: string) {
    // Los retiros son payouts cuyo order_id empieza por el prefijo wdr-
    const all = await db
      .select()
      .from(payouts)
      .where(eq(payouts.recipientId, userId))
      .orderBy(desc(payouts.createdAt));
    return all.filter((p: any) =>
      (p.orderId || "").startsWith(WITHDRAWAL_ORDER_PREFIX),
    );
  }

  // Admin: Aprobar un retiro (marcar pagado + liquidar el saldo retenido)
  async approveWithdrawal(withdrawalId: string, adminId: string) {
    const [withdrawal] = await db
      .select()
      .from(payouts)
      .where(eq(payouts.id, withdrawalId))
      .limit(1);

    if (!withdrawal || withdrawal.status !== "pending") {
      throw new Error("Solicitud no válida");
    }

    await db
      .update(payouts)
      .set({
        status: "paid",
        paidBy: adminId,
        paidAt: new Date(),
      })
      .where(eq(payouts.id, withdrawalId));

    // Liquidar el saldo retenido
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, withdrawal.recipientId))
      .limit(1);
    if (wallet) {
      await db
        .update(wallets)
        .set({
          pendingBalance: Math.max(
            0,
            (wallet.pendingBalance || 0) - withdrawal.amount,
          ),
          totalWithdrawn: (wallet.totalWithdrawn || 0) + withdrawal.amount,
        })
        .where(eq(wallets.userId, withdrawal.recipientId));
    }

    // Notificar al recipiente que su retiro fue enviado
    try {
      const { sendPushToUser } = await import("./enhancedPushService");
      await sendPushToUser(withdrawal.recipientId, {
        title: "💰 Retiro enviado",
        body: `ComeYa ha enviado tu retiro de €${(withdrawal.amount / 100).toFixed(2)}. Revísalo en tu cuenta.`,
        data: { screen: "Wallet", payoutId: withdrawal.id },
      });
    } catch (notifyError) {
      console.error("Error notifying withdrawal approval:", notifyError);
    }

    return { success: true };
  }
}

export const withdrawalService = new WithdrawalService();

// Función independiente para obtener balance de wallet
export async function getWalletBalance(userId: string) {
  try {
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    if (!wallet) {
      await db.insert(wallets).values({
        userId,
        balance: 0,
        pendingBalance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        cashOwed: 0,
      });

      return {
        success: true,
        balance: 0,
        pendingBalance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        cashOwed: 0,
        availableForWithdrawal: 0,
      };
    }

    const availableForWithdrawal = Math.max(
      0,
      wallet.balance - (wallet.cashOwed || 0),
    );

    return {
      success: true,
      balance: wallet.balance,
      pendingBalance: wallet.pendingBalance || 0,
      totalEarned: wallet.totalEarned || 0,
      totalWithdrawn: wallet.totalWithdrawn || 0,
      cashOwed: wallet.cashOwed || 0,
      availableForWithdrawal,
    };
  } catch (error: any) {
    console.error("Error getting wallet balance:", error);
    throw new Error("Error al obtener balance de wallet");
  }
}

// Función para obtener historial de retiros
export async function getWithdrawalHistory(userId: string) {
  return withdrawalService.getWithdrawalHistory(userId);
}

// Función para solicitar retiro
export async function requestWithdrawal(request: WithdrawalRequest) {
  return await withdrawalService.requestWithdrawal(request);
}

// Función para cancelar retiro
export async function cancelWithdrawal(withdrawalId: string, userId: string) {
  try {
    const [withdrawal] = await db
      .select()
      .from(payouts)
      .where(
        and(
          eq(payouts.id, withdrawalId),
          eq(payouts.recipientId, userId),
          eq(payouts.status, "pending"),
        ),
      )
      .limit(1);

    if (!withdrawal) {
      throw new Error(
        "Solicitud de retiro no encontrada o no se puede cancelar",
      );
    }

    await db
      .update(payouts)
      .set({ status: "cancelled", paidAt: new Date() })
      .where(eq(payouts.id, withdrawalId));

    // Devolver el saldo retenido
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);
    if (wallet) {
      await db
        .update(wallets)
        .set({
          balance: wallet.balance + withdrawal.amount,
          pendingBalance: Math.max(
            0,
            (wallet.pendingBalance || 0) - withdrawal.amount,
          ),
        })
        .where(eq(wallets.userId, userId));
    }

    // Notificar al usuario que su retiro fue cancelado y el saldo devuelto
    try {
      const { sendPushToUser } = await import("./enhancedPushService");
      await sendPushToUser(userId, {
        title: "↩️ Retiro cancelado",
        body: `Tu solicitud de retiro de €${(withdrawal.amount / 100).toFixed(2)} fue cancelada y el saldo fue devuelto a tu wallet.`,
        data: { screen: "Wallet", payoutId: withdrawal.id },
      });
    } catch (notifyError) {
      console.error("Error notifying withdrawal cancellation:", notifyError);
    }

    return {
      success: true,
      message: "Solicitud de retiro cancelada",
    };
  } catch (error: any) {
    console.error("Error cancelling withdrawal:", error);
    throw new Error(error.message || "Error al cancelar retiro");
  }
}
