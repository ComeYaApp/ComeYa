import { db } from "./db";
import { wallets, withdrawalRequests, users } from "../shared/schema-mysql";
import { eq, and, desc } from "drizzle-orm";

const MINIMUM_WITHDRAWAL = 5000; // Bs. 50 en centavos

export interface WithdrawalRequest {
  userId: string;
  amount: number;
  method: "pago_movil" | "bank_transfer";
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

export class WithdrawalService {
  async requestWithdrawal(request: WithdrawalRequest) {
    // 1. Validar usando unifiedFinancialService
    const { financialService } = await import("./unifiedFinancialService");
    const { users } = await import("../shared/schema-mysql");

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
      throw new Error(
        canWithdraw.reason || "No puedes retirar en este momento",
      );
    }

    const wallet = await financialService.getWallet(request.userId);
    const availableBalance = wallet.balance - (wallet.cashOwed || 0);

    if (request.amount > availableBalance) {
      throw new Error("Saldo insuficiente");
    }

    // 2. Crear solicitud
    await db.insert(withdrawalRequests).values({
      userId: request.userId,
      walletId: wallet.id,
      amount: request.amount,
      method: request.method,
      pagoMovilPhone: request.pagoMovilPhone,
      pagoMovilBank: request.pagoMovilBank,
      pagoMovilCedula: request.pagoMovilCedula,
      bankAccountNumber: request.bankAccount?.accountNumber,
      bankName: request.bankAccount?.bankName,
      accountHolder: request.bankAccount?.accountHolder,
      accountType: request.bankAccount?.accountType,
      status: "pending",
      requestedAt: new Date(),
    });

    // Obtener la solicitud creada
    const [withdrawal] = await db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.userId, request.userId))
      .orderBy(desc(withdrawalRequests.requestedAt))
      .limit(1);

    return withdrawal; // Admin procesará manualmente
  }

  async getWithdrawalHistory(userId: string) {
    return await db
      .select({
        id: withdrawalRequests.id,
        amount: withdrawalRequests.amount,
        method: withdrawalRequests.method,
        status: withdrawalRequests.status,
        requestedAt: withdrawalRequests.requestedAt,
        completedAt: withdrawalRequests.completedAt,
        errorMessage: withdrawalRequests.errorMessage,
      })
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.userId, userId))
      .orderBy(desc(withdrawalRequests.requestedAt));
  }

  // Admin: Aprobar retiro bancario manual
  async approveWithdrawal(withdrawalId: string, adminId: string) {
    const [withdrawal] = await db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.id, withdrawalId))
      .limit(1);

    if (!withdrawal || withdrawal.status !== "pending") {
      throw new Error("Solicitud no válida");
    }

    await db.transaction(async (tx) => {
      // Marcar como completado
      await tx
        .update(withdrawalRequests)
        .set({
          status: "completed",
          completedAt: new Date(),
          approvedBy: adminId,
        })
        .where(eq(withdrawalRequests.id, withdrawalId));

      // Descontar de wallet
      await tx
        .update(wallets)
        .set({
          balance: db.raw(`balance - ${withdrawal.amount}`),
        })
        .where(eq(wallets.userId, withdrawal.userId));
    });

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
      // Crear wallet si no existe
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
  try {
    const withdrawals = await db
      .select({
        id: withdrawalRequests.id,
        amount: withdrawalRequests.amount,
        method: withdrawalRequests.method,
        status: withdrawalRequests.status,
        requestedAt: withdrawalRequests.requestedAt,
        completedAt: withdrawalRequests.completedAt,
        errorMessage: withdrawalRequests.errorMessage,
      })
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.userId, userId))
      .orderBy(desc(withdrawalRequests.requestedAt));

    return {
      success: true,
      withdrawals,
    };
  } catch (error: any) {
    console.error("Error getting withdrawal history:", error);
    throw new Error("Error al obtener historial de retiros");
  }
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
      .from(withdrawalRequests)
      .where(
        and(
          eq(withdrawalRequests.id, withdrawalId),
          eq(withdrawalRequests.userId, userId),
          eq(withdrawalRequests.status, "pending"),
        ),
      )
      .limit(1);

    if (!withdrawal) {
      throw new Error(
        "Solicitud de retiro no encontrada o no se puede cancelar",
      );
    }

    await db
      .update(withdrawalRequests)
      .set({
        status: "cancelled",
        completedAt: new Date(),
      })
      .where(eq(withdrawalRequests.id, withdrawalId));

    return {
      success: true,
      message: "Solicitud de retiro cancelada",
    };
  } catch (error: any) {
    console.error("Error cancelling withdrawal:", error);
    throw new Error("Error al cancelar retiro");
  }
}
