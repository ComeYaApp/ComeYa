// Cobro automático diario de tarifas de reservas: para cada dueño con deuda
// igual o superior al umbral (defecto 5 €) se intenta el cargo off-session
// con la tarjeta guardada. Sin Stripe o sin tarjeta se queda como deuda
// visible que el negocio puede pagar en la app (tarjeta o comprobante).
import cron from "node-cron";
import { ReservationFeeSettlementService } from "./reservationFeeSettlementService";

export function startReservationFeeChargeCron() {
  // Diario a las 04:15 (hora del servidor)
  cron.schedule("15 4 * * *", async () => {
    try {
      if (!process.env.STRIPE_SECRET_KEY) {
        console.log("💳 Fee charge cron: Stripe no configurado, omitido");
        return;
      }
      const owners =
        await ReservationFeeSettlementService.ownersWithOutstanding();
      console.log(
        `💳 Fee charge cron: ${owners.length} dueño(s) con tarifas pendientes`,
      );

      for (const { ownerId, outstandingCents } of owners) {
        const result = await ReservationFeeSettlementService.autoChargeOwner(
          ownerId,
        );
        if (result.status === "charged") {
          console.log(
            `💳 Fee auto-charge ${ownerId}: ${(result.amountCents / 100).toFixed(2)} €`,
          );
        } else if (result.status === "failed") {
          console.warn(
            `💳 Fee auto-charge ${ownerId} FALLÓ (${result.reason}). Deuda: ${(outstandingCents / 100).toFixed(2)} €`,
          );
        }
      }
    } catch (err) {
      console.error("Fee charge cron error:", (err as Error).message);
    }
  });

  console.log("💳 Reservation fee charge cron scheduled (15 4 * * *)");
}
