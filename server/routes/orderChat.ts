import express from 'express';
import { authenticateToken } from '../authMiddleware';
import { eq, and } from 'drizzle-orm';

const router = express.Router();

// GET /api/orders/:orderId/chat - Obtener mensajes del chat
router.get('/:orderId/chat', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { orders, users } = await import('@shared/schema-mysql');
    const { db } = await import('../db');

    // Verificar que el usuario tiene acceso a este pedido
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    // Verificar permisos: cliente, repartidor o admin
    const isCustomer = order.userId === req.user!.id;
    const isDriver = order.deliveryPersonId === req.user!.id;
    const isAdmin = req.user!.role === 'admin' || req.user!.role === 'super_admin';

    if (!isCustomer && !isDriver && !isAdmin) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // Obtener mensajes del chat (almacenados en JSON en la orden)
    const chatMessages = order.chatMessages ? JSON.parse(order.chatMessages) : [];

    res.json({
      success: true,
      messages: chatMessages,
      orderId,
      order: {
        id: order.id,
        status: order.status,
        userId: order.userId,
        deliveryPersonId: order.deliveryPersonId,
        businessId: order.businessId,
      },
    });
  } catch (error: any) {
    console.error('Get chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/orders/:orderId/chat - Enviar mensaje
router.post('/:orderId/chat', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { message, receiverId } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Mensaje vacío' });
    }

    const { orders, users } = await import('@shared/schema-mysql');
    const { db } = await import('../db');

    // Obtener la orden
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    // Verificar permisos
    const isCustomer = order.userId === req.user!.id;
    const isDriver = order.deliveryPersonId === req.user!.id;
    const isAdmin = req.user!.role === 'admin' || req.user!.role === 'super_admin';

    if (!isCustomer && !isDriver && !isAdmin) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // Obtener datos del remitente
    const [sender] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user!.id))
      .limit(1);

    // Crear nuevo mensaje
    const newMessage = {
      id: `msg-${Date.now()}`,
      orderId,
      senderId: req.user!.id,
      senderName: sender?.name || 'Usuario',
      receiverId: receiverId || (isCustomer ? order.deliveryPersonId : order.userId),
      message: message.trim(),
      createdAt: new Date().toISOString(),
      isRead: false,
    };

    // Obtener mensajes existentes
    const chatMessages = order.chatMessages ? JSON.parse(order.chatMessages) : [];
    chatMessages.push(newMessage);

    // Actualizar la orden con el nuevo mensaje
    await db
      .update(orders)
      .set({
        chatMessages: JSON.stringify(chatMessages),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    // Enviar notificación push al receptor
    try {
      const { sendPushToUser } = await import('../enhancedPushService');
      const receiverName = sender?.name || 'Cliente';
      const roleText = isDriver ? 'Repartidor' : 'Cliente';
      
      await sendPushToUser(newMessage.receiverId, {
        title: `💬 Nuevo mensaje de ${roleText}`,
        body: message.substring(0, 50),
        data: { orderId, screen: 'OrderChat' },
      });
    } catch (e) {
      console.error('Error sending push notification:', e);
    }

    res.json({
      success: true,
      message: newMessage,
      messages: chatMessages,
    });
  } catch (error: any) {
    console.error('Send message error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/orders/:orderId/chat/:messageId/read - Marcar mensaje como leído
router.patch('/:orderId/chat/:messageId/read', authenticateToken, async (req, res) => {
  try {
    const { orderId, messageId } = req.params;
    const { orders } = await import('@shared/schema-mysql');
    const { db } = await import('../db');

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const chatMessages = order.chatMessages ? JSON.parse(order.chatMessages) : [];
    const messageIndex = chatMessages.findIndex((m: any) => m.id === messageId);

    if (messageIndex === -1) {
      return res.status(404).json({ error: 'Mensaje no encontrado' });
    }

    chatMessages[messageIndex].isRead = true;

    await db
      .update(orders)
      .set({
        chatMessages: JSON.stringify(chatMessages),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    res.json({ success: true, message: 'Mensaje marcado como leído' });
  } catch (error: any) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
