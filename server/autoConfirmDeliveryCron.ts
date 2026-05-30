import cron from "node-cron";
import { db } from "./db";
import {
  orders,
  wallets,
  transactions,
  businesses,
} from "@shared/schema-mysql";
import { eq, and, lt, isNull } from "drizzle-orm";

/**
 * Auto-confirm deliveries after 12 hours if customer hasn't confirmed
 * Runs every hour
 */
export function startAutoConfirmCron() {
  // Run every hour
  cron.schedule("0 * * * *", async () => {
    try {
      console.log("🔄 Running auto-confirm delivery cron...");

      // Find orders delivered more than 12 hours ago without customer confirmation
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

      const ordersToConfirm = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.status, "delivered"),
            isNull(orders.confirmedByCustomer),
            lt(orders.deliveredAt, twelveHoursAgo),
          ),
        );

      console.log(`📦 Found ${ordersToConfirm.length} orders to auto-confirm`);

      for (const order of ordersToConfirm) {
        try {
          // Calculate commissions
          const { financialService } = await import(
            "./unifiedFinancialService"
          );
          const commissions = await financialService.calculateCommissions(
            order.total,
            order.deliveryFee,
            order.productosBase || order.subtotal,
            order.nemyCommission || undefined,
          );

          // Update order with confirmation
          await db
            .update(orders)
            .set({
              confirmedByCustomer: true,
              confirmedByCustomerAt: new Date(),
              platformFee: commissions.platform,
              businessEarnings: commissions.business,
              deliveryEarnings: commissions.driver,
            })
            .where(eq(orders.id, order.id));

          const [business] = await db
            .select({ ownerId: businesses.ownerId })
            .from(businesses)
            .where(eq(businesses.id, order.businessId))
            .limit(1);

          const businessOwnerId = business?.ownerId || order.businessId;

          if (order.paymentMethod === "cash") {
            const { cashSettlementService } = await import(
              "./cashSettlementService"
            );
            await cashSettlementService.registerCashDebt(
              order.id,
              order.deliveryPersonId,
              order.businessId,
              order.total,
              order.deliveryFee,
            );
          } else {
            // Update business wallet
            const [businessWallet] = await db
              .select()
              .from(wallets)
              .where(eq(wallets.userId, businessOwnerId))
              .limit(1);

            if (businessWallet) {
              await db
                .update(wallets)
                .set({
                  balance: businessWallet.balance + commissions.business,
                  totalEarned:
                    businessWallet.totalEarned + commissions.business,
                })
                .where(eq(wallets.userId, businessOwnerId));
            } else {
              await db.insert(wallets).values({
                userId: businessOwnerId,
                balance: commissions.business,
                pendingBalance: 0,
                totalEarned: commissions.business,
                totalWithdrawn: 0,
              });
            }

            // Update driver wallet
            if (order.deliveryPersonId) {
              const [driverWallet] = await db
                .select()
                .from(wallets)
                .where(eq(wallets.userId, order.deliveryPersonId))
                .limit(1);

              if (driverWallet) {
                await db
                  .update(wallets)
                  .set({
                    balance: driverWallet.balance + commissions.driver,
                    totalEarned: driverWallet.totalEarned + commissions.driver,
                  })
                  .where(eq(wallets.userId, order.deliveryPersonId));
              } else {
                await db.insert(wallets).values({
                  userId: order.deliveryPersonId,
                  balance: commissions.driver,
                  pendingBalance: 0,
                  totalEarned: commissions.driver,
                  totalWithdrawn: 0,
                });
              }
            }

            // Create transaction records
            await db.insert(transactions).values([
              {
                userId: businessOwnerId,
                type: "order_payment",
                amount: commissions.business,
                status: "completed",
                description: `Pago automático por pedido #${order.id.slice(-8)}`,
                orderId: order.id,
              },
              {
                userId: order.deliveryPersonId,
                type: "delivery_payment",
                amount: commissions.driver,
                status: "completed",
                description: `Pago automático entrega #${order.id.slice(-8)}`,
                orderId: order.id,
              },
            ]);
          }

          console.log(`✅ Auto-confirmed order ${order.id.slice(-8)}`);
        } catch (error) {
          console.error(`❌ Error auto-confirming order ${order.id}:`, error);
        }
      }

      console.log("✅ Auto-confirm cron completed");
    } catch (error) {
      console.error("❌ Auto-confirm cron error:", error);
    }
  });

  console.log("⏰ Auto-confirm delivery cron started (runs every hour)");
}
