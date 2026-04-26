import { db } from './db';
import { supportTickets, ticketMessages } from '@shared/schema-mysql';
import { eq, and, desc } from 'drizzle-orm';
import { sendPushToUser } from './enhancedPushService';

export class SupportService {
  static async createTicket(data: {
    userId: string;
    orderId?: string;
    subject: string;
    category: 'order_issue' | 'payment' | 'delivery' | 'other';
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    initialMessage: string;
  }) {
    const [result] = await db.insert(supportTickets).values({
      userId: data.userId,
      orderId: data.orderId,
      subject: data.subject,
      category: data.category,
      priority: data.priority || 'medium',
      status: 'open',
    });

    const ticketId = (result as any).insertId;

    // Guardar mensaje inicial
    await db.insert(ticketMessages).values({
      ticketId,
      senderId: data.userId,
      senderType: 'user',
      message: data.initialMessage,
    });

    return { success: true, ticketId };
  }

  static async getUserTickets(userId: string) {
    return db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.userId, userId))
      .orderBy(desc(supportTickets.createdAt));
  }

  static async getTicket(ticketId: string, userId: string) {
    const [ticket] = await db
      .select()
      .from(supportTickets)
      .where(and(eq(supportTickets.id, ticketId), eq(supportTickets.userId, userId)))
      .limit(1);

    if (!ticket) throw new Error('Ticket no encontrado');

    const messages = await db
      .select()
      .from(ticketMessages)
      .where(eq(ticketMessages.ticketId, ticketId))
      .orderBy(ticketMessages.createdAt);

    return { ticket, messages };
  }

  static async addMessage(data: {
    ticketId: string;
    senderId: string;
    senderType: 'user' | 'admin';
    message: string;
  }) {
    await db.insert(ticketMessages).values({
      ticketId: data.ticketId,
      senderId: data.senderId,
      senderType: data.senderType,
      message: data.message,
    });

    await db
      .update(supportTickets)
      .set({ updatedAt: new Date() })
      .where(eq(supportTickets.id, data.ticketId));

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

  static async updateTicketStatus(
    ticketId: string,
    status: 'open' | 'in_progress' | 'resolved' | 'closed',
    adminId?: string
  ) {
    const updateData: any = { status, updatedAt: new Date() };
    if (status === 'resolved' || status === 'closed') updateData.resolvedAt = new Date();
    if (adminId) updateData.assignedTo = adminId;

    await db.update(supportTickets).set(updateData).where(eq(supportTickets.id, ticketId));
    return { success: true };
  }

  static async getPendingTickets() {
    return db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.status, 'open'))
      .orderBy(desc(supportTickets.createdAt));
  }

  static async assignTicket(ticketId: string, adminId: string) {
    await db
      .update(supportTickets)
      .set({ assignedTo: adminId, status: 'in_progress', updatedAt: new Date() })
      .where(eq(supportTickets.id, ticketId));
    return { success: true };
  }
}
