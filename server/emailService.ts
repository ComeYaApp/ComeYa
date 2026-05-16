import { Resend } from "resend";

// Initialize Resend only if API key is available
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = "ComeYa <noreply@comeya.es>";

// Helper to check if email service is available
function isEmailServiceAvailable(): boolean {
  if (!resend) {
    console.log(
      "[Email] Resend API key not configured - email service disabled",
    );
    return false;
  }
  return true;
}

export async function sendVerificationEmail(
  email: string,
  name: string,
  verificationCode: string,
): Promise<boolean> {
  if (!isEmailServiceAvailable()) return false;
  try {
    const { data, error } = await resend!.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Verifica tu cuenta de MOUZO",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Nunito', Arial, sans-serif; background-color: #FAFAFA; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 16px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="color: #00C853; font-size: 32px; margin: 0;">MOUZO</h1>
              <p style="color: #757575; margin-top: 8px;">Tu delivery local de confianza</p>
            </div>
            
            <h2 style="color: #212121; font-size: 24px; margin-bottom: 16px;">Hola ${name},</h2>
            
            <p style="color: #424242; font-size: 16px; line-height: 1.6;">
              Gracias por registrarte en MOUZO. Para completar tu registro y empezar a pedir, 
              ingresa el siguiente código de verificación:
            </p>
            
            <div style="background-color: #E8F5E9; border-radius: 12px; padding: 24px; text-align: center; margin: 32px 0;">
              <span style="font-size: 36px; font-weight: bold; color: #00C853; letter-spacing: 8px;">${verificationCode}</span>
            </div>
            
            <p style="color: #757575; font-size: 14px; line-height: 1.6;">
              Este código expira en 10 minutos. Si no solicitaste esta verificación, 
              puedes ignorar este correo.
            </p>
            
            <hr style="border: none; border-top: 1px solid #E0E0E0; margin: 32px 0;">
            
            <p style="color: #9E9E9E; font-size: 12px; text-align: center;">
              MOUZO - Delivery local en San Cristóbal, Táchira<br>
              Este es un correo automático, por favor no responder.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Error sending verification email:", error);
      return false;
    }

    console.log("Verification email sent:", data?.id);
    return true;
  } catch (error) {
    console.error("Error sending verification email:", error);
    return false;
  }
}

export async function sendOrderConfirmationEmail(
  email: string,
  name: string,
  orderId: string,
  businessName: string,
  total: number,
  estimatedDelivery: string,
): Promise<boolean> {
  if (!isEmailServiceAvailable()) return false;
  try {
    const { data, error } = await resend!.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Pedido confirmado #${orderId.slice(-6)} - MOUZO`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Nunito', Arial, sans-serif; background-color: #FAFAFA; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 16px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="color: #00C853; font-size: 32px; margin: 0;">MOUZO</h1>
            </div>
            
            <div style="background-color: #E8F5E9; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
              <span style="font-size: 48px;">&#10003;</span>
              <h2 style="color: #00C853; margin: 8px 0;">Pedido Confirmado</h2>
            </div>
            
            <h3 style="color: #212121; margin-bottom: 8px;">Hola ${name},</h3>
            
            <p style="color: #424242; font-size: 16px; line-height: 1.6;">
              Tu pedido de <strong>${businessName}</strong> ha sido confirmado y está siendo preparado.
            </p>
            
            <div style="background-color: #F5F5F5; border-radius: 12px; padding: 20px; margin: 24px 0;">
              <p style="margin: 8px 0; color: #424242;">
                <strong>Pedido:</strong> #${orderId.slice(-6)}
              </p>
              <p style="margin: 8px 0; color: #424242;">
                <strong>Total:</strong> $${total.toFixed(2)} MXN
              </p>
              <p style="margin: 8px 0; color: #424242;">
                <strong>Entrega estimada:</strong> ${estimatedDelivery}
              </p>
            </div>
            
            <p style="color: #757575; font-size: 14px;">
              Puedes seguir el estado de tu pedido en la app de MOUZO.
            </p>
            
            <hr style="border: none; border-top: 1px solid #E0E0E0; margin: 32px 0;">
            
            <p style="color: #9E9E9E; font-size: 12px; text-align: center;">
              MOUZO - Delivery local en San Cristóbal, Táchira
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Error sending order confirmation email:", error);
      return false;
    }

    console.log("Order confirmation email sent:", data?.id);
    return true;
  } catch (error) {
    console.error("Error sending order confirmation email:", error);
    return false;
  }
}

export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
