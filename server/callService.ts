// Automatic Calling Service with Twilio Studio Flows
import twilio from "twilio";
import { db } from "./db";
import { orders, businesses, callLogs } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";
import { getSettingValue } from "./systemSettingsService";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

interface CallResult {
  success: boolean;
  callSid?: string;
  error?: string;
}

// Make automatic call to business when order is received
export async function callBusinessForOrder(
  orderId: string,
): Promise<CallResult> {
  try {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      return { success: false, error: "Order not found" };
    }

    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, order.businessId))
      .limit(1);

    if (!business || !business.phone) {
      return { success: false, error: "Business phone not found" };
    }

    // Get Twilio configuration from settings
    const studioFlowSid = await getSettingValue("twilio_studio_flow_sid");
    const fromNumber = await getSettingValue("twilio_phone_number");

    if (!studioFlowSid || !fromNumber) {
      return { success: false, error: "Twilio configuration missing" };
    }

    // Create call using Studio Flow
    const call = await client.calls.create({
      to: business.phone,
      from: fromNumber,
      url: `${process.env.BACKEND_URL}/api/twilio/studio-flow/${studioFlowSid}`,
      method: "POST",
      statusCallback: `${process.env.BACKEND_URL}/api/twilio/call-status`,
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    });

    // Log the call
    await db.insert(callLogs).values({
      orderId,
      businessId: order.businessId,
      phoneNumber: business.phone,
      callSid: call.sid,
      status: "initiated",
      purpose: "order_notification",
      createdAt: new Date(),
    });

    return {
      success: true,
      callSid: call.sid,
    };
  } catch (error: any) {
    console.error("Call business error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Generate TwiML for Studio Flow
export function generateOrderNotificationTwiML(
  orderId: string,
  businessName: string,
  orderTotal: number,
) {
  const message = `Hola ${businessName}. Tienes un nuevo pedido número ${orderId} por $${orderTotal} pesos. Presiona 1 para aceptar, 2 para rechazar, o 3 para escuchar de nuevo.`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf" timeout="10" numDigits="1" action="/api/twilio/handle-response/${orderId}" method="POST">
    <Say voice="alice" language="es-VE">${message}</Say>
  </Gather>
  <Say voice="alice" language="es-VE">No se recibió respuesta. El pedido quedará pendiente.</Say>
</Response>`;
}

// Handle business response to call
export async function handleCallResponse(
  orderId: string,
  digits: string,
  callSid: string,
) {
  try {
    let action = "";
    let newStatus = "";

    switch (digits) {
      case "1":
        action = "accepted";
        newStatus = "confirmed";
        break;
      case "2":
        action = "rejected";
        newStatus = "cancelled";
        break;
      case "3":
        action = "repeat";
        // Return TwiML to repeat message
        const [order] = await db
          .select()
          .from(orders)
          .where(eq(orders.id, orderId))
          .limit(1);
        const [business] = await db
          .select()
          .from(businesses)
          .where(eq(businesses.id, order?.businessId || ""))
          .limit(1);
        return generateOrderNotificationTwiML(
          orderId,
          business?.name || "",
          order?.total || 0,
        );
      default:
        action = "invalid";
        return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="es-VE">Opción inválida. Presiona 1 para aceptar, 2 para rechazar.</Say>
  <Redirect>/api/twilio/studio-flow</Redirect>
</Response>`;
    }

    if (newStatus) {
      // Update order status
      await db
        .update(orders)
        .set({
          status: newStatus,
          businessResponseAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));

      // Update call log
      await db
        .update(callLogs)
        .set({
          response: digits,
          responseAction: action,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(callLogs.callSid, callSid));

      // If rejected, process cancellation
      if (newStatus === "cancelled") {
        const { cancelOrder } = await import("./orderCancellationService");
        await cancelOrder(
          orderId,
          "system",
          "Business rejected order via phone",
        );
      }
    }

    const responseMessage =
      action === "accepted"
        ? "Pedido aceptado. Gracias."
        : "Pedido rechazado. Gracias.";

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="es-VE">${responseMessage}</Say>
</Response>`;
  } catch (error: any) {
    console.error("Handle call response error:", error);
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="es-VE">Error procesando respuesta.</Say>
</Response>`;
  }
}

// Update call status from Twilio webhook
export async function updateCallStatus(
  callSid: string,
  status: string,
  duration?: string,
) {
  try {
    await db
      .update(callLogs)
      .set({
        status,
        duration: duration ? parseInt(duration) : null,
        updatedAt: new Date(),
      })
      .where(eq(callLogs.callSid, callSid));

    console.log(`📞 Call ${callSid} status updated: ${status}`);
  } catch (error: any) {
    console.error("Update call status error:", error);
  }
}

// Get call history for business
export async function getBusinessCallHistory(businessId: string) {
  try {
    const history = await db
      .select()
      .from(callLogs)
      .where(eq(callLogs.businessId, businessId))
      .orderBy(callLogs.createdAt)
      .limit(50);

    return {
      success: true,
      calls: history,
    };
  } catch (error: any) {
    console.error("Get call history error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Admin: Get all call logs
export async function getAllCallLogs() {
  try {
    const logs = await db
      .select()
      .from(callLogs)
      .orderBy(callLogs.createdAt)
      .limit(100);

    return {
      success: true,
      calls: logs,
    };
  } catch (error: any) {
    console.error("Get all call logs error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Test call functionality
export async function testCall(phoneNumber: string): Promise<CallResult> {
  try {
    const fromNumber = await getSettingValue("twilio_phone_number");

    if (!fromNumber) {
      return { success: false, error: "Twilio phone number not configured" };
    }

    const call = await client.calls.create({
      to: phoneNumber,
      from: fromNumber,
      twiml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="es-VE">Esta es una llamada de prueba del sistema ComeYa. Todo funciona correctamente.</Say>
</Response>`,
    });

    return {
      success: true,
      callSid: call.sid,
    };
  } catch (error: any) {
    console.error("Test call error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}
