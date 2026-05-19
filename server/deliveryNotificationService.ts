import { db } from "./db";
import { users, deliveryDrivers } from "@shared/schema-mysql";
import { eq, and, desc, or } from "drizzle-orm";
import { sendPushToUser } from "./enhancedPushService";

interface NotificationData {
  title: string;
  body: string;
  data?: Record<string, any>;
}

// ==========================================
// SERVICIO DE NOTIFICACIONES PARA DELIVERY
// ==========================================

export class DeliveryNotificationService {
  /**
   * Notificar al repartidor que su verificación ha sido aprobada
   */
  static async notifyApproved(userId: string): Promise<boolean> {
    try {
      const [user] = await db
        .select({ name: users.name, phone: users.phone })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) return false;

      // Push notification
      await sendPushToUser(userId, {
        title: "🎉 ¡Estás aprobado!",
        body: "¡Felicidades! Ya puedes empezar a repartidor. Abre la app para ver tus pedidos disponibles.",
        data: {
          screen: "DriverDashboard",
          action: "verification_approved",
        },
      });

      // También notificar por SMS si hay número
      if (user.phone && process.env.TWILIO_ACCOUNT_SID) {
        try {
          const twilio = require("twilio")(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
          );
          await twilio.messages.create({
            body: `🎉 ¡ComeYa te espera! Tu cuenta de repartidor ha sido aprobada. Abre la app para empezar a trabajar.`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: user.phone,
          });
        } catch { /*silencioso*/ }
      }

      return true;
    } catch (error) {
      console.error("Error notifying approval:", error);
      return false;
    }
  }

  /**
   * Notificar al repartidor que ha sido rechazado
   */
  static async notifyRejected(userId: string, reason: string): Promise<boolean> {
    try {
      const [user] = await db
        .select({ name: users.name, phone: users.phone })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) return false;

      // Push notification
      await sendPushToUser(userId, {
        title: "📋 Verificación no aprobada",
        body: `Tu solicitud necesita ajustes: ${reason}. Abre la app para más detalles.`,
        data: {
          screen: "DriverVerification",
          action: "verification_rejected",
          reason,
        },
      });

      // Actualizar notas de verificación
      await db
        .update(users)
        .set({ verificationNotes: reason } as any)
        .where(eq(users.id, userId));

      return true;
    } catch (error) {
      console.error("Error notifying rejection:", error);
      return false;
    }
  }

  /**
   * Notificar al repartidor que hay documentos pendientes por actualizar
   */
  static async notifyDocumentsNeeded(userId: string, missingDocs: string[]): Promise<boolean> {
    try {
      const docNames: Record<string, string> = {
        idDocumentUrl: "DNI (frente)",
        idDocumentBackUrl: "DNI (reverso)",
        vehicleLicensePhoto: "Licencia de conducir",
        vehiclePhoto: "Foto del vehículo",
        vehiclePlatePhoto: "Foto de matrícula",
        vehicleItvPhoto: "ITV",
        vehicleInsurancePhoto: "Seguro",
        autonomoDocumentUrl: "Documento de autónomo",
      };

      const missingNames = missingDocs
        .map(d => docNames[d] || d)
        .join(", ");

      await sendPushToUser(userId, {
        title: "📄 Documentos requeridos",
        body: `Para completar tu verificación necesitas: ${missingNames}`,
        data: {
          screen: "DriverVerification",
          action: "documents_needed",
        },
      });

      return true;
    } catch (error) {
      console.error("Error notifying documents needed:", error);
      return false;
    }
  }

  /**
   * Notificar a los admins que hay un nuevo repartidor pendiente
   */
  static async notifyNewDriverToAdmins(userId: string): Promise<boolean> {
    try {
      const [user] = await db
        .select({ name: users.name, phone: users.phone })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) return false;

      // Importar función de WebSocket
      try {
        const { notifyAdmins } = await import("./websocket");
        notifyAdmins({
          type: "new_delivery_verification",
          userId,
          userName: user.name,
          phone: user.phone,
          message: `Nuevo repartidor pendiente: ${user.name} (${user.phone})`,
        });
      } catch { /*silencioso*/ }

      // Enviar push a admins
      const admins = await db
        .select({ id: users.id })
        .from(users)
        .where(
          or(
            eq(users.role, "admin"),
            eq(users.role, "super_admin")
          )
        );

      for (const admin of admins) {
        await sendPushToUser(admin.id, {
          title: "👤 Nuevo repartidor",
          body: `${user.name} quiere ser repartidor. Revisa su documentación.`,
          data: {
            screen: "AdminVerification",
            userId,
          },
        });
      }

      return true;
    } catch (error) {
      console.error("Error notifying admins:", error);
      return false;
    }
  }

  /**
   * Notificar al repartidor que hay un nuevo pedido asignado
   */
  static async notifyNewOrder(driverId: string, orderId: string, businessName: string): Promise<boolean> {
    try {
      await sendPushToUser(driverId, {
        title: "🛍️ Nuevo pedido asignado",
        body: `Recoge el pedido en ${businessName} y llévalo al cliente`,
        data: {
          screen: "OrderTracking",
          orderId,
          action: "new_order",
        },
      });

      return true;
    } catch (error) {
      console.error("Error notifying new order:", error);
      return false;
    }
  }

  /**
   * Notificar al repartidor que hay un pedido cerca
   */
  static async notifyOrderNearby(driverId: string, orderId: string, distance: number): Promise<boolean> {
    try {
      await sendPushToUser(driverId, {
        title: "📍 Pedido cerca",
        body: `Tienes un pedido a ${Math.round(distance / 1000)} km de distancia`,
        data: {
          screen: "DriverMap",
          orderId,
          action: "order_nearby",
        },
      });

      return true;
    } catch (error) {
      console.error("Error notifying order nearby:", error);
      return false;
    }
  }

  /**
   * Notificar al repartidor que su cuenta ha sido bloqueada
   */
  static async notifyBlocked(userId: string, reason: string): Promise<boolean> {
    try {
      await sendPushToUser(userId, {
        title: "🔒 Cuenta suspendida",
        body: `Tu cuenta ha sido suspendida: ${reason}. Contacta soporte para más información.`,
        data: {
          screen: "Support",
          action: "account_blocked",
        },
      });

      return true;
    } catch (error) {
      console.error("Error notifying blocked:", error);
      return false;
    }
  }

  /**
   * Notificar al repartidor sobre strike
   */
  static async notifyStrike(userId: string, strikeCount: number, reason: string): Promise<boolean> {
    try {
      const remaining = 3 - strikeCount;
      
      await sendPushToUser(userId, {
        title: `⚠️ Strike(${strikeCount}/3)`,
        body: remaining > 0 
          ? `Has recibido un strike: ${reason}. Te quedan ${remaining} antes de suspensión.`
          : `Tu cuenta está en riesgo: ${reason}`,
        data: {
          screen: "DriverDashboard",
          action: "strike_added",
        },
      });

      return true;
    } catch (error) {
      console.error("Error notifying strike:", error);
      return false;
    }
  }

  /**
   * Notificar al repartidor sobre Earnings
   */
  static async notifyEarnings(driverId: string, amount: number, period: string): Promise<boolean> {
    try {
      const amountStr = (amount / 100).toFixed(2);
      
      await sendPushToUser(driverId, {
        title: "💰 Ganancias disponibles",
        body: `Tienes €${amountStr} ${period}. Solicita tu retiro.`,
        data: {
          screen: "DriverEarnings",
          action: "earnings_available",
        },
      });

      return true;
    } catch (error) {
      console.error("Error notifying earnings:", error);
      return false;
    }
  }

  // ==========================================
  // BROADCAST A TODOS LOS DRIVERS
  // ==========================================

  /**
   * Enviar notificación a todos los drivers activos
   */
  static async broadcastToDrivers(title: string, body: string, data?: Record<string, any>): Promise<number> {
    try {
      const allDrivers = await db
        .select({ id: deliveryDrivers.userId })
        .from(deliveryDrivers)
        .where(eq(deliveryDrivers.isAvailable, true));

      let sent = 0;
      for (const driver of allDrivers) {
        try {
          await sendPushToUser(driver.userId, { title, body, data });
          sent++;
        } catch { /*continuar*/ }
      }

      return sent;
    } catch (error) {
      console.error("Error broadcasting:", error);
      return 0;
    }
  }
}

export const deliveryNotificationService = DeliveryNotificationService;
