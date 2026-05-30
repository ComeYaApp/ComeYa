import express from "express";
import { authenticateToken, requireRole } from "./authMiddleware";

const router = express.Router();

// Helper function for AI responses
async function generateAIResponse(
  message: string,
  history: any[],
): Promise<string> {
  const fallbackResponse = `Gracias por tu mensaje. Un agente de soporte revisará tu consulta pronto.

¿Necesitas ayuda con:
• Realizar un pedido
• Seguimiento de entregas
• Información de negocios
• Problemas con pagos
• Otra consulta

Por favor, describe tu consulta con más detalle.`;

  try {
    const openaiKey = process.env.OPENAI_API_KEY;
    const geminiKey =
      process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

    if (openaiKey) {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content: `Eres un asistente de soporte para MOUZO, una plataforma de delivery en San Cristóbal, Táchira, Venezuela.

INFORMACIÓN CLAVE:
- MOUZO significa "vivir" en náhuatl
- Conectamos negocios locales, clientes y repartidores
- Comisiones: 15% del producto para MOUZO, 100% del producto para el negocio, 100% del delivery para el repartidor
- Pagos con tarjeta (Stripe) o efectivo
- Autenticación solo por teléfono con SMS
- Zona de cobertura: San Cristóbal y alrededores

Responde de manera amigable, profesional y concisa en español.`,
              },
              { role: "user", content: message },
            ],
            max_tokens: 500,
            temperature: 0.7,
          }),
        },
      );

      if (response.ok) {
        const data = await response.json();
        return data.choices?.[0]?.message?.content || fallbackResponse;
      }
    }

    if (geminiKey) {
      // Primero intentar listar modelos disponibles
      const listResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`,
        { method: "GET", headers: { "Content-Type": "application/json" } },
      );

      if (listResponse.ok) {
        const models = await listResponse.json();
        console.log("Available models:", JSON.stringify(models, null, 2));
      }

      const contents = [
        {
          role: "user",
          parts: [
            {
              text: `Eres un asistente de soporte para MOUZO. Responde en español de forma amigable y concisa.\n\nUsuario: ${message}`,
            },
          ],
        },
      ];

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents }),
        },
      );

      if (response.ok) {
        const data = await response.json();
        console.log("Gemini response:", JSON.stringify(data));
        return (
          data.candidates?.[0]?.content?.parts?.[0]?.text || fallbackResponse
        );
      } else {
        console.log("Gemini error:", response.status, await response.text());
      }
    }

    return fallbackResponse;
  } catch (error) {
    console.error("AI Error:", error);
    return fallbackResponse;
  }
}

// ============================================
// USER SUPPORT ROUTES
// ============================================

// Get user's own tickets
router.get("/tickets/:userId", authenticateToken, async (req, res) => {
  try {
    const { supportChats } = await import("@shared/schema-mysql");
    const { db } = await import("./db");
    const { eq, desc } = await import("drizzle-orm");

    const tickets = await db
      .select()
      .from(supportChats)
      .where(eq(supportChats.userId, req.params.userId))
      .orderBy(desc(supportChats.createdAt));

    res.json({ success: true, tickets });
  } catch (error: any) {
    console.error("Error fetching user tickets:", error);
    res.status(500).json({ error: error.message });
  }
});

// AI Chat endpoint (for real-time support)
router.post("/chat", authenticateToken, async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Generate AI response using Gemini
    const response = await generateAIResponse(message, history || []);

    res.json({ success: true, response });
  } catch (error: any) {
    console.error("AI chat error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create new support chat/ticket
router.post("/tickets", authenticateToken, async (req, res) => {
  try {
    const { supportChats, supportMessages } = await import(
      "@shared/schema-mysql"
    );
    const { db } = await import("./db");
    const { randomUUID } = await import("crypto");

    const { message, subject, priority } = req.body;
    const chatId = randomUUID();

    await db.insert(supportChats).values({
      id: chatId,
      userId: req.user!.id,
      status: "open",
    });

    await db.insert(supportMessages).values({
      id: randomUUID(),
      chatId,
      userId: req.user!.id,
      message: subject || message,
      isBot: false,
    });

    res.json({ success: true, chatId });
  } catch (error: any) {
    console.error("Error creating ticket:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get messages for a ticket (USER)
router.get("/tickets/:id/messages", authenticateToken, async (req, res) => {
  try {
    const { supportMessages, supportChats } = await import(
      "@shared/schema-mysql"
    );
    const { db } = await import("./db");
    const { eq, and } = await import("drizzle-orm");

    // Verificar que el ticket pertenece al usuario
    const [ticket] = await db
      .select()
      .from(supportChats)
      .where(eq(supportChats.id, req.params.id))
      .limit(1);

    if (
      !ticket ||
      (ticket.userId !== req.user!.id &&
        req.user!.role !== "admin" &&
        req.user!.role !== "super_admin")
    ) {
      return res.status(403).json({ error: "No tienes acceso a este ticket" });
    }

    const messages = await db
      .select()
      .from(supportMessages)
      .where(eq(supportMessages.chatId, req.params.id))
      .orderBy(supportMessages.createdAt);

    res.json({ success: true, messages });
  } catch (error: any) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: error.message });
  }
});

// Send message to ticket (USER)
router.post("/tickets/:id/messages", authenticateToken, async (req, res) => {
  try {
    const { supportMessages, supportChats } = await import(
      "@shared/schema-mysql"
    );
    const { db } = await import("./db");
    const { randomUUID } = await import("crypto");
    const { eq } = await import("drizzle-orm");

    // Verificar que el ticket pertenece al usuario
    const [ticket] = await db
      .select()
      .from(supportChats)
      .where(eq(supportChats.id, req.params.id))
      .limit(1);

    if (
      !ticket ||
      (ticket.userId !== req.user!.id &&
        req.user!.role !== "admin" &&
        req.user!.role !== "super_admin")
    ) {
      return res.status(403).json({ error: "No tienes acceso a este ticket" });
    }

    const { message } = req.body;

    const isAdmin =
      req.user!.role === "admin" || req.user!.role === "super_admin";

    const newMessage = {
      id: randomUUID(),
      chatId: req.params.id,
      userId: req.user!.id,
      message,
      isBot: false,
      isAdmin,
    };

    await db.insert(supportMessages).values(newMessage);

    res.json({ success: true, message: newMessage });
  } catch (error: any) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create new support chat/ticket (legacy)
router.post("/create-ticket", authenticateToken, async (req, res) => {
  try {
    const { supportChats, supportMessages } = await import(
      "@shared/schema-mysql"
    );
    const { db } = await import("./db");
    const { randomUUID } = await import("crypto");

    const { message, subject, category } = req.body;
    const chatId = randomUUID();

    // Create chat
    await db.insert(supportChats).values({
      id: chatId,
      userId: req.user!.id,
      subject: subject || "Consulta de soporte",
      category: category || "general",
      status: "open",
      priority: "medium",
    });

    // Create first message
    await db.insert(supportMessages).values({
      id: randomUUID(),
      chatId,
      userId: req.user!.id,
      message,
      isBot: false,
      isAdmin: false,
    });

    res.json({ success: true, chatId });
  } catch (error: any) {
    console.error("Error creating support chat:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ADMIN SUPPORT ROUTES
// ============================================

// Get all support tickets (ADMIN)
router.get(
  "/admin/tickets",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { supportChats, users } = await import("@shared/schema-mysql");
      const { db } = await import("./db");
      const { eq, desc } = await import("drizzle-orm");

      const tickets = await db
        .select()
        .from(supportChats)
        .orderBy(desc(supportChats.createdAt));

      const enrichedTickets = await Promise.all(
        tickets.map(async (ticket) => {
          const [user] = await db
            .select({
              id: users.id,
              name: users.name,
              email: users.email,
              phone: users.phone,
            })
            .from(users)
            .where(eq(users.id, ticket.userId))
            .limit(1);

          return {
            id: ticket.id,
            userId: ticket.userId,
            userName: user?.name || "Usuario",
            userEmail: user?.email || "",
            subject: ticket.subject || "Sin asunto",
            status: ticket.status || "open",
            priority: ticket.priority || "medium",
            category: ticket.category || "general",
            createdAt: ticket.createdAt,
            updatedAt: ticket.updatedAt,
            lastMessageAt: ticket.updatedAt,
            messageCount: 0,
          };
        }),
      );

      res.json({ success: true, tickets: enrichedTickets });
    } catch (error: any) {
      console.error("Error fetching tickets:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// Update ticket status
router.put(
  "/tickets/:id",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { supportChats } = await import("@shared/schema-mysql");
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");

      const { status, priority } = req.body;

      await db
        .update(supportChats)
        .set({
          ...(status && { status }),
          ...(priority && { priority }),
          updatedAt: new Date(),
        })
        .where(eq(supportChats.id, req.params.id));

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating ticket:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

export default router;
