// Twilio Verify Service for MOUZO - Phone Verification
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

function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");

  if (cleaned.startsWith("52")) {
    return `+${cleaned}`;
  }

  if (cleaned.length === 10) {
    return `+58${cleaned}`;
  }

  if (cleaned.startsWith("+")) {
    return cleaned;
  }

  return `+${cleaned}`;
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
  // Development bypass - always return true
  if (
    process.env.NODE_ENV === "development" ||
    !process.env.TWILIO_ACCOUNT_SID
  ) {
    console.log(`🔧 DEV MODE: SMS bypass for ${toPhoneNumber}, use code: 1234`);
    return true;
  }

  try {
    const client = getTwilioClient();
    const serviceSid = getVerifyServiceSid();

    if (!client || !serviceSid) {
      console.log(
        `🔧 Twilio not configured, bypassing SMS for ${toPhoneNumber}`,
      );
      return true;
    }

    const formattedPhone = formatPhoneNumber(toPhoneNumber);

    // Use Twilio Verify to send verification code
    const verification = await client.verify.v2
      .services(serviceSid)
      .verifications.create({
        to: formattedPhone,
        channel: "sms",
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
  // Development bypass - accept code 1234
  if (
    process.env.NODE_ENV === "development" ||
    !process.env.TWILIO_ACCOUNT_SID
  ) {
    console.log(
      `🔧 DEV MODE: Code verification for ${toPhoneNumber}, code: ${code}`,
    );
    return code === "1234";
  }

  try {
    const client = getTwilioClient();
    const serviceSid = getVerifyServiceSid();

    if (!client || !serviceSid) {
      console.log(
        `🔧 Twilio not configured, accepting code 1234 for ${toPhoneNumber}`,
      );
      return code === "1234";
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
