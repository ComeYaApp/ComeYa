import { db } from './db';
import { supportTickets } from '@shared/schema-mysql';
import { eq, and, desc } from 'drizzle-orm';
import { sendPushToUser } from './enhancedPushService';

export class SupportService {
  // Crear ticket
  static async createTicket(data: {
    userId: string;
    orderId?: string;
    subject: string;
    category: 'order_issue' | 'payment' | 'delivery' | 'other';
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    initialMessage: string;
  }) {
    const [ticket] = await db.insert(supportTickets).values({
      userId: data.userId,
      orderId: data.orderId,
      subject: data.subject,
      category: data.category,
      priority: data.priority || 'medium',
      status: 'open',
    });

    const ticketId = ticket.insertId;

    // TODO: Guardar mensaje inicial en una tabla de mensajes de tickets cuando se cree
    // Por ahora el mensaje inicial se guarda en el subject

    // Notificar a admins
    // TODO: Implementar notificación a admins

    return { success: true, ticketId };
  }

  // Obtener tickets del usuario
  static async getUserTickets(userId: string) {
    const tickets = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.userId, userId))
      .orderBy(desc(supportTickets.createdAt));

    return tickets;
  }

  // Obtener ticket por ID
  static async getTicket(ticketId: string, userId: string) {
    const [ticket] = await db
      .select()
      .from(supportTickets)
      .where(
        and(
          eq(supportTickets.id, ticketId),
          eq(supportTickets.userId, userId)
        )
      )
      .limit(1);

    if (!ticket) {
      throw new Error('Ticket no encontrado');
    }

    // TODO: Obtener mensajes del ticket cuando se implemente la tabla
    const messages: any[] = [];

    return { ticket, messages };
  }

  // Agregar mensaje al ticket
  static async addMessage(data: {
    ticketId: string;
    senderId: string;
    senderType: 'user' | 'admin';
    message: string;
    attachments?: string[];
  }) {
    // TODO: Implementar cuando se cree la tabla de mensajes de tickets

    // Actualizar timestamp del ticket
    await db
      .update(supportTickets)
      .set({ updatedAt: new Date() })
      .where(eq(supportTickets.id, data.ticketId));

    // Notificar al usuario si el mensaje es de admin
    if (data.senderType === 'admin') {
      const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, data.ticketId)).limit(1);
      if (ticket) {
        await sendPushToUser(ticket.userId, {
          title: 'Respuesta de Soporte',
          body: data.message.substring(0, 100),
          data: { ticketId: data.ticketId, screen: 'SupportChat' },
        });
      }
    }

    return { success: true };
  }

  // Actualizar estado del ticket
  static async updateTicketStatus(
    ticketId: string,
    status: 'open' | 'in_progress' | 'resolved' | 'closed',
    adminId?: string
  ) {
    const updateData: any = { status, updatedAt: new Date() };

    if (status === 'resolved' || status === 'closed') {
      updateData.resolvedAt = new Date();
    }

    if (adminId) {
      updateData.assignedTo = adminId;
    }

    await db
      .update(supportTickets)
      .set(updateData)
      .where(eq(supportTickets.id, ticketId));

    return { success: true };
  }

  // Obtener tickets pendientes (para admins)
  static async getPendingTickets() {
    const tickets = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.status, 'open'))
      .orderBy(desc(supportTickets.priority), desc(supportTickets.createdAt));

    return tickets;
  }

  // Asignar ticket a admin
  static async assignTicket(ticketId: string, adminId: string) {
    await db
      .update(supportTickets)
      .set({
        assignedTo: adminId,
        status: 'in_progress',
        updatedAt: new Date(),
      })
      .where(eq(supportTickets.id, ticketId));

    return { success: true };
  }
}
