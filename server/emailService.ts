// Envío de emails transaccionales con Resend.
// RESEND_API_KEY es opcional en env: si no está configurada los envíos se
// omiten con un aviso en consola (la notificación push sigue funcionando).
//
// REMITENTE (EMAIL_FROM):
//  - Sin dominio verificado en Resend: solo se puede enviar desde
//    "onboarding@resend.dev" y ÚNICAMENTE al correo del dueño de la cuenta
//    de Resend (modo pruebas).
//  - Tras verificar comeya.es (Domains → Add Domain → registros DNS), poner
//    EMAIL_FROM="ComeYa <no-reply@comeya.es>" en Render y ya se puede
//    escribir a cualquier cliente.
import { Resend } from "resend";

let client: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

// Remitente por defecto: el de pruebas de Resend (funciona sin verificar
// dominio). En producción, configurar EMAIL_FROM en Render con el dominio
// verificado.
const DEFAULT_FROM = "ComeYa <onboarding@resend.dev>";

function emailFrom(): string {
  return process.env.EMAIL_FROM || DEFAULT_FROM;
}

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<{ sent: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) {
    console.warn("📧 Email omitido: RESEND_API_KEY no configurado");
    return { sent: false, error: "RESEND_API_KEY no configurado" };
  }
  try {
    const result = await resend.emails.send({
      from: emailFrom(),
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    if ((result as any)?.error) {
      // Resend devuelve el motivo en error (p. ej. dominio sin verificar)
      const msg =
        (result as any).error?.message || JSON.stringify((result as any).error);
      console.error("📧 Resend rechazó el envío:", msg);
      return { sent: false, error: msg };
    }
    return { sent: true };
  } catch (e: any) {
    // Los 403 de Resend explican el motivo: dominio sin verificar, destinatario
    // no permitido en modo pruebas, etc. Registrar el cuerpo completo ayuda
    console.error(
      "📧 Error enviando email:",
      e?.message,
      JSON.stringify(e?.response?.data ?? ""),
    );
    return { sent: false, error: e?.message };
  }
}

// Email con el código de la gift card (comprador y destinatario)
export async function sendGiftCardCodeEmail(opts: {
  to: string;
  code: string;
  amountEuros: string;
  message?: string | null;
}): Promise<{ sent: boolean }> {
  const { to, code, amountEuros, message } = opts;
  const result = await sendEmail({
    to,
    subject: "🎁 Tu tarjeta regalo ComeYa",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #FFF7F4; border-radius: 12px;">
        <h2 style="color: #DC2626; margin: 0 0 12px;">🎁 Tarjeta regalo ComeYa</h2>
        <p style="color: #333;">Alguien te ha regalado una tarjeta ComeYa de <strong>${amountEuros} €</strong>.</p>
        ${
          message
            ? `<p style="color: #555; font-style: italic;">"${message}"</p>`
            : ""
        }
        <p style="color: #333;">Tu código para pagar pedidos en la app:</p>
        <div style="background: #DC2626; color: #fff; font-size: 22px; font-weight: 700; letter-spacing: 2px; text-align: center; padding: 16px; border-radius: 8px;">
          ${code}
        </div>
        <p style="color: #777; font-size: 13px; margin-top: 16px;">
          Úsalo en el checkout eligiendo "ComeYaCard" como método de pago.
          Válido 30 días desde su activación.
        </p>
      </div>
    `,
  });
  return { sent: result.sent };
}
