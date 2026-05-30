// Development-only routes for local testing
import express from "express";

const router = express.Router();

// Development email/password login (LOCAL ONLY)
router.post("/auth/dev-email-login", async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production") {
      return res
        .status(404)
        .json({ error: "Endpoint not available in production" });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email y password son requeridos" });
    }

    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("./db");
    const { eq } = await import("drizzle-orm");
    const bcrypt = await import("bcrypt");
    const jwt = await import("jsonwebtoken");

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: "Usuario no encontrado" });
    }

    if (!user.password) {
      return res.status(401).json({ error: "Usuario sin contraseña" });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    const token = jwt.default.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || "demo-secret",
      { expiresIn: "7d" },
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        phoneVerified: true, // Skip verification for dev
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
