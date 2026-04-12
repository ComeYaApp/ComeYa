import express from "express";
import { authenticateToken } from "../authMiddleware";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";

const router = express.Router();

const signToken = (userId: string) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET || "mouzo_local_secret_key", { expiresIn: "7d" });

// POST /api/auth/send-code  (inicia login por teléfono O reenvía código)
router.post("/send-code", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Teléfono requerido" });

    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const [user] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);

    if (!user) return res.json({ userNotFound: true });

    if (process.env.TWILIO_ACCOUNT_SID) {
      const { sendVerificationCode } = await import("../smsService");
      const code = "123456";
      await sendVerificationCode(phone, code);
    } else {
      console.log(`[DEV] Código SMS para ${phone}: 123456`);
    }

    res.json({ success: true, requiresVerification: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/phone-login  (verifica código y devuelve token)
router.post("/phone-login", async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ error: "Teléfono y código requeridos" });

    // Verificar código
    let isValid = false;
    if (process.env.TWILIO_ACCOUNT_SID) {
      const { verifyCode } = await import("../smsService");
      isValid = await verifyCode(phone, code);
    } else {
      isValid = code === "123456"; // Código de desarrollo
    }

    if (!isValid) return res.status(400).json({ error: "Código inválido" });

    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    let [user] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);

    if (!user) {
      const newUser: any = {
        id: crypto.randomUUID(),
        phone,
        name: `Usuario ${phone.slice(-4)}`,
        role: "customer",
        isActive: true,
        phoneVerified: true,
        createdAt: new Date(),
      };
      await db.insert(users).values(newUser);
      user = newUser;
    } else {
      // Actualizar usuario existente para marcar teléfono como verificado
      await db.update(users).set({ phoneVerified: true, isActive: true } as any).where(eq(users.id, user.id));
      user.phoneVerified = true;
      user.isActive = true;
    }

    const token = signToken(user.id);
    res.json({ success: true, token, user: { id: user.id, name: user.name, phone: user.phone, role: user.role, isActive: user.isActive, phoneVerified: user.phoneVerified } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/phone-signup
router.post("/phone-signup", async (req, res) => {
  try {
    const { name, role, phone, email, password } = req.body;
    if (!phone || !name) return res.status(400).json({ error: "Nombre y teléfono requeridos" });

    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const [existing] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
    if (existing) return res.status(400).json({ error: "El teléfono ya está registrado" });

    // Hash password if provided
    let hashedPassword = null;
    if (password) {
      const bcrypt = await import("bcrypt");
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const newUser: any = {
      id: crypto.randomUUID(),
      phone,
      name,
      email: email || null,
      password: hashedPassword,
      role: role || "customer",
      isActive: true,
      phoneVerified: false,
      createdAt: new Date(),
    };

    await db.insert(users).values(newUser);

    if (process.env.TWILIO_ACCOUNT_SID) {
      const { sendVerificationCode } = await import("../smsService");
      const code = "123456";
      await sendVerificationCode(phone, code);
    } else {
      console.log(`[DEV] Código SMS para ${phone}: 123456`);
    }

    res.json({ success: true, requiresVerification: true, userId: newUser.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/dev-email-login  (login con email y contraseña)
router.post("/dev-email-login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email y contraseña requeridos" });

    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    // Verificar contraseña
    if (user.password) {
      const bcrypt = await import("bcrypt");
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) return res.status(401).json({ error: "Contraseña incorrecta" });
    } else {
      return res.status(401).json({ error: "Esta cuenta no tiene contraseña configurada" });
    }

    const token = signToken(user.id);
    res.json({ success: true, token, user: { id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role, isActive: user.isActive, phoneVerified: user.phoneVerified } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/biometric-login
router.post("/biometric-login", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Teléfono requerido" });

    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const [user] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    const token = signToken(user.id);
    res.json({ success: true, token, user: { id: user.id, name: user.name, phone: user.phone, role: user.role, isActive: user.isActive, phoneVerified: user.phoneVerified, biometricEnabled: user.biometricEnabled } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/enable-biometric
router.post("/enable-biometric", authenticateToken, async (req, res) => {
  try {
    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    await db.update(users).set({ biometricEnabled: true } as any).where(eq(users.id, req.user!.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/disable-biometric
router.post("/disable-biometric", authenticateToken, async (req, res) => {
  try {
    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    await db.update(users).set({ biometricEnabled: false } as any).where(eq(users.id, req.user!.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/logout
router.post("/logout", authenticateToken, async (req, res) => {
  res.json({ success: true, message: "Sesión cerrada" });
});

// GET /api/auth/me
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const [user] = await db.select().from(users).where(eq(users.id, req.user!.id)).limit(1);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ success: true, user: { id: user.id, name: user.name, phone: user.phone, role: user.role, isActive: user.isActive, profileImage: user.profileImage } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;