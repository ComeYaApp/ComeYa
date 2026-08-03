// Twilio Verify Service for ComeYa - Phone Verification
// Uses Twilio Verify API for secure SMS verification
import twilio from "twilio";

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    console.warn(
      "Twilio credentials not configured. SMS will be bypassed in development.",
    );
    return null;
  }

  return twilio(accountSid, authToken);
}

function getVerifyServiceSid(): string | null {
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!serviceSid) {
    console.warn("TWILIO_VERIFY_SERVICE_SID not configured");
    return null;
  }
  return serviceSid;
}

// Normaliza números de teléfono españoles (+34)
function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");

  // Ya tiene prefijo +
  if (phone.startsWith("+")) {
    return phone.replace(/[\s-()]/g, "");
  }

  // Ya tiene código de España sin +
  if (cleaned.startsWith("34")) {
    return `+${cleaned}`;
  }

  // Número español de 9 dígitos (móvil: 6xx/7xx, fijo: 9xx)
  if (
    cleaned.length === 9 &&
    (cleaned.startsWith("6") ||
      cleaned.startsWith("7") ||
      cleaned.startsWith("9"))
  ) {
    return `+34${cleaned}`;
  }

  // Fallback: añadir +34
  return `+34${cleaned}`;
}

// Generate a local verification code (kept for backwards compatibility with DB storage)
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send verification SMS using Twilio Verify API
export async function sendVerificationSMS(
  toPhoneNumber: string,
  code: string,
): Promise<boolean> {
  try {
    const client = getTwilioClient();
    const serviceSid = getVerifyServiceSid();

    if (!client || !serviceSid) {
      console.error("Twilio no configurado. No se puede enviar SMS.");
      return false;
    }

    const formattedPhone = formatPhoneNumber(toPhoneNumber);

    // Use Twilio Verify to send verification code
    const verification = await client.verify.v2
      .services(serviceSid)
      .verifications.create({
        to: formattedPhone,
        channel: "sms",
        locale: "es",
        customFriendlyName: "ComeYa",
      });

    console.log(
      `Twilio Verify SMS sent to ${formattedPhone}, status: ${verification.status}`,
    );
    return verification.status === "pending";
  } catch (error: any) {
    console.error("Failed to send verification SMS:", error?.message || error);
    return false;
  }
}

// Verify the code using Twilio Verify API
export async function verifyCode(
  toPhoneNumber: string,
  code: string,
): Promise<boolean> {
  try {
    const client = getTwilioClient();
    const serviceSid = getVerifyServiceSid();

    if (!client || !serviceSid) {
      console.log(
        `🔧 Twilio not configured, rejecting code for ${toPhoneNumber}`,
      );
      return false;
    }

    const formattedPhone = formatPhoneNumber(toPhoneNumber);

    const verificationCheck = await client.verify.v2
      .services(serviceSid)
      .verificationChecks.create({
        to: formattedPhone,
        code: code,
      });

    console.log(
      `Twilio Verify check for ${formattedPhone}, status: ${verificationCheck.status}`,
    );
    return verificationCheck.status === "approved";
  } catch (error: any) {
    console.error("Failed to verify code:", error?.message || error);
    return false;
  }
}

// Export alias for backwards compatibility
export const sendVerificationCode = sendVerificationSMS;
