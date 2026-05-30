import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { SupportService } from "../supportService";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = express.Router();

const SYSTEM_PROMPT = `Eres el asistente virtual de ComeYa, una plataforma de delivery en Soria, España.
Respondes en español, de forma amable, concisa y útil.
Solo respondes preguntas relacionadas con ComeYa: pedidos, pagos, entregas, negocios, repartidores, cuenta, etc.
Si la pregunta no tiene relación con ComeYa, redirige amablemente al tema.
Métodos de pago aceptados: Bizum, transferencia IBAN, tarjeta, efectivo.
Política de cancelación: gratis en los primeros 60 segundos, luego pueden aplicar cargos.
Tiempos de entrega estimados: 30-45 minutos según distancia y disponibilidad.
Si el usuario tiene un problema urgente con un pedido activo, sugíere crear un ticket de soporte.`;

// Chat con IA (Gemini)
router.post("/chat", authenticateToken, async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Mensaje requerido" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "IA no configurada" });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Construir historial para contexto
    const chatHistory = (history || []).slice(-8).map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
        {
          role: "model",
          parts: [
            {
              text: "Entendido. Soy el asistente de ComeYa, listo para ayudar.",
            },
          ],
        },
        ...chatHistory,
      ],
    });

    const result = await chat.sendMessage(message);
    const response = result.response.text();

    res.json({ success: true, response });
  } catch (error: any) {
    console.error("Support chat error:", error);
    // Fallback si falla Gemini
    res.json({
      success: true,
      response:
        "Lo siento, el asistente no está disponible en este momento. Por favor crea un ticket de soporte y te responderemos pronto.",
    });
  }
});

// Crear ticket
router.post("/tickets", authenticateToken, async (req, res) => {
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
router.get("/tickets", authenticateToken, async (req, res) => {
  try {
    const tickets = await SupportService.getUserTickets(req.user!.id);
    res.json({ success: true, tickets });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener ticket específico
router.get("/tickets/:id", authenticateToken, async (req, res) => {
  try {
    const data = await SupportService.getTicket(req.params.id, req.user!.id);
    res.json({ success: true, ...data });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

// Agregar mensaje
router.post("/tickets/:id/messages", authenticateToken, async (req, res) => {
  try {
    const result = await SupportService.addMessage({
      ticketId: req.params.id,
      senderId: req.user!.id,
      senderType:
        req.user!.role === "admin" || req.user!.role === "super_admin"
          ? "admin"
          : "user",
      ...req.body,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar estado (solo admin)
router.patch(
  "/tickets/:id/status",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const result = await SupportService.updateTicketStatus(
        req.params.id,
        req.body.status,
        req.user!.id,
      );
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Obtener tickets pendientes (solo admin)
router.get(
  "/admin/pending",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const tickets = await SupportService.getPendingTickets();
      res.json({ success: true, tickets });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Asignar ticket (solo admin)
router.post(
  "/tickets/:id/assign",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const result = await SupportService.assignTicket(
        req.params.id,
        req.user!.id,
      );
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

export default router;
