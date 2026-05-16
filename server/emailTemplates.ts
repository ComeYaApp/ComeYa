import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface OrderEmailData {
  customerName: string;
  orderNumber: string;
  businessName: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  total: number;
  deliveryAddress: string;
  estimatedTime?: string;
}

export async function sendOrderConfirmationEmail(
  to: string,
  data: OrderEmailData
) {
  const itemsList = data.items
    .map(item => `<li>${item.quantity}x ${item.name} - $${item.price.toFixed(2)}</li>`)
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .order-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .items { list-style: none; padding: 0; }
          .items li { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
          .total { font-size: 20px; font-weight: bold; color: #10b981; margin-top: 15px; }
          .footer { text-align: center; color: #6b7280; margin-top: 30px; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 ¡Pedido Confirmado!</h1>
          </div>
          <div class="content">
            <p>Hola <strong>${data.customerName}</strong>,</p>
            <p>Tu pedido ha sido confirmado y está siendo preparado.</p>
            
            <div class="order-details">
              <h2>Pedido #${data.orderNumber}</h2>
              <p><strong>Negocio:</strong> ${data.businessName}</p>
              <p><strong>Dirección de entrega:</strong> ${data.deliveryAddress}</p>
              ${data.estimatedTime ? `<p><strong>Tiempo estimado:</strong> ${data.estimatedTime}</p>` : ''}
              
              <h3>Artículos:</h3>
              <ul class="items">
                ${itemsList}
              </ul>
              
              <p class="total">Total: $${data.total.toFixed(2)} MXN</p>
            </div>
            
            <p>Te notificaremos cuando tu pedido esté en camino.</p>
            <p>¡Gracias por usar ComeYa! 🚀</p>
          </div>
          <div class="footer">
            <p>ComeYa - Delivery en Soria</p>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    await resend.emails.send({
      from: 'ComeYa <pedidos@comeya.es>',
      to,
      subject: `Pedido Confirmado #${data.orderNumber}`,
      html,
    });
  } catch (error) {
    console.error('Error sending confirmation email:', error);
  }
}

export async function sendOrderOnTheWayEmail(
  to: string,
  data: OrderEmailData & { driverName: string; driverPhone: string }
) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .driver-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
          .footer { text-align: center; color: #6b7280; margin-top: 30px; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚴 ¡Tu pedido va en camino!</h1>
          </div>
          <div class="content">
            <p>Hola <strong>${data.customerName}</strong>,</p>
            <p>Tu pedido #${data.orderNumber} está en camino a tu ubicación.</p>
            
            <div class="driver-info">
              <h2>Tu repartidor</h2>
              <p><strong>${data.driverName}</strong></p>
              <p>📱 ${data.driverPhone}</p>
            </div>
            
            <p><strong>Dirección de entrega:</strong> ${data.deliveryAddress}</p>
            ${data.estimatedTime ? `<p><strong>Llegada estimada:</strong> ${data.estimatedTime}</p>` : ''}
            
            <p>¡Prepárate para recibir tu pedido! 🎉</p>
          </div>
          <div class="footer">
            <p>ComeYa - Delivery en Soria</p>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    await resend.emails.send({
      from: 'ComeYa <pedidos@comeya.es>',
      to,
      subject: `Tu pedido #${data.orderNumber} va en camino 🚴`,
      html,
    });
  } catch (error) {
    console.error('Error sending on-the-way email:', error);
  }
}

export async function sendOrderDeliveredEmail(
  to: string,
  data: OrderEmailData
) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .cta { background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0; }
          .footer { text-align: center; color: #6b7280; margin-top: 30px; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ ¡Pedido Entregado!</h1>
          </div>
          <div class="content">
            <p>Hola <strong>${data.customerName}</strong>,</p>
            <p>Tu pedido #${data.orderNumber} ha sido entregado exitosamente.</p>
            
            <p>Esperamos que disfrutes tu pedido de <strong>${data.businessName}</strong>.</p>
            
            <div style="text-align: center;">
              <a href="https://app.comeya.es/orders/${data.orderNumber}/review" class="cta">
                ⭐ Califica tu experiencia
              </a>
            </div>
            
            <p>Tu opinión nos ayuda a mejorar el servicio.</p>
            <p>¡Gracias por usar ComeYa! 🎉</p>
          </div>
          <div class="footer">
            <p>ComeYa - Delivery en Soria</p>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    await resend.emails.send({
      from: 'ComeYa <pedidos@comeya.es>',
      to,
      subject: `Pedido Entregado #${data.orderNumber} ✅`,
      html,
    });
  } catch (error) {
    console.error('Error sending delivered email:', error);
  }
}

export async function sendPaymentReceiptEmail(
  to: string,
  data: OrderEmailData & { paymentMethod: string; transactionId: string }
) {
  const itemsList = data.items
    .map(item => `<li>${item.quantity}x ${item.name} - $${item.price.toFixed(2)}</li>`)
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #6366f1; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .receipt { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .items { list-style: none; padding: 0; }
          .items li { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
          .total { font-size: 20px; font-weight: bold; color: #6366f1; margin-top: 15px; }
          .footer { text-align: center; color: #6b7280; margin-top: 30px; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🧾 Recibo de Pago</h1>
          </div>
          <div class="content">
            <p>Hola <strong>${data.customerName}</strong>,</p>
            <p>Este es tu recibo de pago para el pedido #${data.orderNumber}.</p>
            
            <div class="receipt">
              <h2>Detalles del Pago</h2>
              <p><strong>Pedido:</strong> #${data.orderNumber}</p>
              <p><strong>Negocio:</strong> ${data.businessName}</p>
              <p><strong>Método de pago:</strong> ${data.paymentMethod}</p>
              <p><strong>ID de transacción:</strong> ${data.transactionId}</p>
              
              <h3>Artículos:</h3>
              <ul class="items">
                ${itemsList}
              </ul>
              
              <p class="total">Total Pagado: $${data.total.toFixed(2)} MXN</p>
            </div>
            
            <p>Gracias por tu compra. 🙏</p>
          </div>
          <div class="footer">
            <p>ComeYa - Delivery en Soria</p>
            <p>Este es un recibo electrónico</p>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    await resend.emails.send({
      from: 'ComeYa <pagos@comeya.es>',
      to,
      subject: `Recibo de Pago - Pedido #${data.orderNumber}`,
      html,
    });
  } catch (error) {
    console.error('Error sending receipt email:', error);
  }
}
