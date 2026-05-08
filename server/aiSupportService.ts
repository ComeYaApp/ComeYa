import { GoogleGenAI } from '@google/genai';
import { db } from './db';
import { supportChats, supportMessages } from '../shared/schema-mysql';
import { eq, desc } from 'drizzle-orm';

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
});

const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

const COMEYA_CONTEXT = `
Eres un asistente de soporte para ComeYa, una plataforma de delivery en Soria, Espana.

INFORMACION CLAVE:
- ComeYa conecta negocios locales, clientes y repartidores en Soria, Castilla y Leon, Espana
- Comisiones: 15% markup sobre precio base para ComeYa, 100% del producto para el negocio, 100% del delivery para el repartidor
- Pagos: Tarjeta (Stripe), Bizum, Transferencia SEPA
- Autenticacion por telefono con SMS o email con contrasena
- Zona de cobertura: Soria y alrededores
- Moneda: Euros (EUR)

FUNCIONALIDADES:
- Pedidos de comida y productos de negocios locales
- Seguimiento en tiempo real con GPS
- Sistema de resenas con fotos
- Modo saturado para negocios
- Menu 86 (productos agotados)
- Pedidos grupales y programados
- Cupones de descuento
- Gamificacion con puntos y recompensas
- Gift cards

POLITICAS DE CANCELACION:
- Pedido pendiente/confirmado: 100% reembolso
- Pedido en preparacion: 80% reembolso
- Pedido listo: 50% reembolso
- Pedido recogido: Sin reembolso

TIEMPOS:
- Periodo de arrepentimiento: 60 segundos
- Llamada automatica a negocio: 3 minutos si no confirma
- Retencion de fondos: 1 hora

SOPORTE:
- Responde de manera amigable y profesional
- Usa emojis ocasionalmente
- Si no sabes algo, ofrece contactar a soporte humano
- Siempre en espanol
- Email de soporte: support@comeya.es
`;

const FAQS = `
PREGUNTAS FRECUENTES:

Como me registro?
- Con tu numero de telefono (recibes SMS con codigo)
- O con email y contrasena

Como hago un pedido?
1. Explora negocios disponibles en Soria
2. Agrega productos al carrito
3. Confirma tu direccion de entrega
4. Elige metodo de pago (tarjeta, Bizum o transferencia)
5. Confirma el pedido

Cuanto tarda la entrega?
- Promedio: 30-45 minutos
- Puedes seguir tu pedido en tiempo real en el mapa

Puedo cancelar un pedido?
- Si, pero el reembolso depende del estado del pedido
- Tienes 60 segundos de arrepentimiento con reembolso completo

Como me convierto en repartidor?
- Registrate en la app como repartidor
- Sube tus documentos (DNI, carnet de conducir)
- Proporciona tu IBAN para recibir pagos
- Espera aprobacion del equipo

Como registro mi negocio?
- Contacta al equipo en negocios@comeya.es
- Configura tu menu y horarios desde la app
- Conecta tu cuenta bancaria (IBAN) para recibir pagos
`;

export async function createSupportChat(userId: string): Promise<string> {
  const chatId = crypto.randomUUID();
  await db.insert(supportChats).values({
    id: chatId,
    userId,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return chatId;
}

export async function sendSupportMessage(
  chatId: string,
  userId: string,
  message: string
): Promise<string> {
  await db.insert(supportMessages).values({
    id: crypto.randomUUID(),
    chatId,
    userId,
    message,
    isBot: false,
    createdAt: new Date(),
  });

  const history = await db
    .select()
    .from(supportMessages)
    .where(eq(supportMessages.chatId, chatId))
    .orderBy(desc(supportMessages.createdAt))
    .limit(10);

  const chatMessages = history.reverse().map(msg => ({
    role: msg.isBot ? 'model' : 'user',
    parts: [{ text: msg.message }],
  }));

  try {
    const chat = model.startChat({
      history: chatMessages,
      generationConfig: {
        maxOutputTokens: 500,
        temperature: 0.7,
      },
      systemInstruction: COMEYA_CONTEXT + '\n\n' + FAQS,
    });

    const result = await chat.sendMessage(message);
    const botResponse = result.response.text() ||
      'Lo siento, no pude procesar tu mensaje. Intenta de nuevo.';

    await db.insert(supportMessages).values({
      id: crypto.randomUUID(),
      chatId,
      userId: null,
      message: botResponse,
      isBot: true,
      createdAt: new Date(),
    });

    await db.update(supportChats).set({ updatedAt: new Date() }).where(eq(supportChats.id, chatId));

    return botResponse;
  } catch (error) {
    console.error('Error generating AI response:', error);
    const fallback = 'Disculpa, estoy teniendo problemas tecnicos. Contacta a support@comeya.es o intenta mas tarde.';
    await db.insert(supportMessages).values({
      id: crypto.randomUUID(),
      chatId,
      userId: null,
      message: fallback,
      isBot: true,
      createdAt: new Date(),
    });
    return fallback;
  }
}

export async function getChatHistory(chatId: string) {
  return db
    .select()
    .from(supportMessages)
    .where(eq(supportMessages.chatId, chatId))
    .orderBy(supportMessages.createdAt);
}

export async function closeSupportChat(chatId: string): Promise<void> {
  await db.update(supportChats).set({ status: 'closed', updatedAt: new Date() }).where(eq(supportChats.id, chatId));
}

export async function escalateToHuman(chatId: string): Promise<void> {
  await db.update(supportChats).set({ status: 'escalated', updatedAt: new Date() }).where(eq(supportChats.id, chatId));
  console.log(`Chat ${chatId} escalated to human support`);
}
