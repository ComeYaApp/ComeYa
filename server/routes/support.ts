import express from 'express';
import { authenticateToken, requireRole } from '../authMiddleware';
import { SupportService } from '../supportService';

const router = express.Router();

// Chat con IA
router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const { message, history } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Mensaje requerido' });
    }

    // Respuesta simple sin IA por ahora
    const responses: Record<string, string> = {
      'pedido': '¿Tienes alguna pregunta sobre un pedido específico? Puedes ver el estado de tus pedidos en la sección "Mis Pedidos" de la app.',
      'entrega': 'Los tiempos de entrega varían según la distancia y disponibilidad de repartidores. Generalmente son entre 30-45 minutos.',
      'pago': 'Aceptamos Bizum, transferencia bancaria, tarjeta de crédito/débito y efectivo contra entrega.',
      'cancelar': 'Puedes cancelar tu pedido sin cargo dentro de los primeros 60 segundos. Después de ese tiempo, pueden aplicar cargos según el estado del pedido.',
      'negocio': '¿Buscas información sobre algún negocio en particular? Puedes explorar todos los negocios disponibles en la pantalla principal.',
      'cuenta': 'Para gestionar tu cuenta, ve a la sección "Perfil" donde puedes editar tu información, direcciones y métodos de pago.',
    };

    const lowerMessage = message.toLowerCase();
    let response = 'Gracias por tu mensaje. Un miembro de nuestro equipo te responderá pronto. Mientras tanto, puedes:';
    response += '\n\n• Revisar el estado de tus pedidos en "Mis Pedidos"';
    response += '\n• Explorar negocios disponibles';
    response += '\n• Contactarnos por WhatsApp para asistencia inmediata';
    response += '\n\n¿Hay algo más en lo que pueda ayudarte?';

    // Buscar palabras clave
    for (const [keyword, reply] of Object.entries(responses)) {
      if (lowerMessage.includes(keyword)) {
        response = reply;
        break;
      }
    }

    res.json({ success: true, response });
  } catch (error: any) {
    console.error('Support chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Crear ticket
router.post('/tickets', authenticateToken, async (req, res) => {
  try {
    const result = await SupportService.createTicket({
      userId: req.user!.id,
      ...req.body,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener tickets del usuario
router.get('/tickets', authenticateToken, async (req, res) => {
  try {
    const tickets = await SupportService.getUserTickets(req.user!.id);
    res.json({ success: true, tickets });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener ticket específico
router.get('/tickets/:id', authenticateToken, async (req, res) => {
  try {
    const data = await SupportService.getTicket(req.params.id, req.user!.id);
    res.json({ success: true, ...data });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

// Agregar mensaje
router.post('/tickets/:id/messages', authenticateToken, async (req, res) => {
  try {
    const result = await SupportService.addMessage({
      ticketId: req.params.id,
      senderId: req.user!.id,
      senderType: req.user!.role === 'admin' || req.user!.role === 'super_admin' ? 'admin' : 'user',
      ...req.body,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar estado (solo admin)
router.patch('/tickets/:id/status', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await SupportService.updateTicketStatus(req.params.id, req.body.status, req.user!.id);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener tickets pendientes (solo admin)
router.get('/admin/pending', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const tickets = await SupportService.getPendingTickets();
    res.json({ success: true, tickets });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Asignar ticket (solo admin)
router.post('/tickets/:id/assign', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await SupportService.assignTicket(req.params.id, req.user!.id);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
