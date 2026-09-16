// Envío de emails transaccionales con Resend.
// RESEND_API_KEY es opcional en env: si no está configurada los envíos se
// omiten con un aviso en consola (la notificación push sigue funcionando).
import { Resend } from "resend";

let client: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
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
    await resend.emails.send({
      from: "ComeYa <no-reply@comeya.es>",
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    return { sent: true };
  } catch (e: any) {
    console.error("📧 Error enviando email:", e?.message);
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
