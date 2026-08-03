import express from "express";
import { authenticateToken } from "../authMiddleware";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";

const router = express.Router();

const signToken = (userId: string) =>
  jwt.sign(
    { id: userId },
    process.env.JWT_SECRET || "comeya_local_secret_key",
    { expiresIn: "7d" },
  );

// POST /api/auth/send-code  (inicia login por teléfono O reenvía código)
router.post("/send-code", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Teléfono requerido" });

    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1);

    if (!user) return res.json({ userNotFound: true });

    const { sendVerificationCode } = await import("../smsService");
    const sent = await sendVerificationCode(phone, "123456");
    if (!sent) {
      return res.status(500).json({ error: "No se pudo enviar el código SMS" });
    }

    res.json({ success: true, requiresVerification: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/phone-login  (verifica código y devuelve token)
router.post("/phone-login", async (req, res) => {
  try {
    const { phone, code, signupData } = req.body;
    if (!phone || !code)
      return res.status(400).json({ error: "Teléfono y código requeridos" });

    // Verificar código con Twilio
    const { verifyCode } = await import("../smsService");
    const isValid = await verifyCode(phone, code);

    if (!isValid) return res.status(400).json({ error: "Código inválido" });

    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1);

    if (!user) {
      // Si viene signupData, crear usuario nuevo
      if (signupData) {
        let hashedPassword = null;
        if (signupData.password) {
          const bcrypt = await import("bcryptjs");
          hashedPassword = await bcrypt.hash(signupData.password, 10);
        }

        const newUser: any = {
          id: crypto.randomUUID(),
          phone,
          name: signupData.name,
          email: signupData.email || null,
          password: hashedPassword,
          role: signupData.role || "customer",
          isActive: signupData.role === "customer" ? true : false, // Solo clientes activos inmediatamente
          phoneVerified: true,
          createdAt: new Date(),
        };
        await db.insert(users).values(newUser);
        user = newUser;
      } else {
        // Login normal sin signup previo
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
      }
    } else {
      // Usuario existe, actualizar verificación
      await db
        .update(users)
        .set({ phoneVerified: true, isActive: true } as any)
        .where(eq(users.id, user.id));
      user.phoneVerified = true;
      user.isActive = true;
    }

    const token = signToken(user.id);
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        phoneVerified: user.phoneVerified,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/phone-signup
router.post("/phone-signup", async (req, res) => {
  try {
    const { name, role, phone, email, password } = req.body;
    if (!phone || !name)
      return res.status(400).json({ error: "Nombre y teléfono requeridos" });

    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1);
    if (existing) {
      // Si la cuenta existe pero NO está verificada ni activa, permitir re-registro
      if (!existing.phoneVerified && !existing.isActive) {
        console.log(`🔄 Re-registro permitido para teléfono no verificado: ${phone} (userId: ${existing.id})`);
        // Limpiar la cuenta vieja para que pueda ser reutilizada
        await db
          .update(users)
          .set({ 
            name: null as any, 
            email: null as any, 
            password: null as any,
            role: "customer" as any,
            dni: null as any,
            updatedAt: new Date(),
          } as any)
          .where(eq(users.id, existing.id));
        // No bloqueamos — continuamos con el flujo de envío de código
      } else {
        return res.status(400).json({ error: "El teléfono ya está registrado" });
      }
    }

    // Crear usuario temporal (no verificado) para poder subir documentos
    let userId = existing?.id;
    if (!userId) {
      let hashedPassword = null;
      if (password) {
        const bcrypt = await import("bcryptjs");
        hashedPassword = await bcrypt.hash(password, 10);
      }
      const tempUser: any = {
        id: crypto.randomUUID(),
        phone,
        name,
        email: email || null,
        password: hashedPassword,
        role: role || "customer",
        isActive: false,
        phoneVerified: false,
        createdAt: new Date(),
      };
      await db.insert(users).values(tempUser);
      userId = tempUser.id;
    } else {
      // Actualizar datos del usuario existente no verificado
      let hashedPassword = null;
      if (password) {
        const bcrypt = await import("bcryptjs");
        hashedPassword = await bcrypt.hash(password, 10);
      }
      await db
        .update(users)
        .set({
          name,
          email: email || null,
          password: hashedPassword,
          role: role || "customer",
          isActive: false,
          phoneVerified: false,
          updatedAt: new Date(),
        } as any)
        .where(eq(users.id, userId));
    }

    // Enviar código de verificación con Twilio
    const { sendVerificationCode } = await import("../smsService");
    const sent = await sendVerificationCode(phone, "123456");
    if (!sent) {
      return res.status(500).json({ error: "No se pudo enviar el código SMS" });
    }

    res.json({ success: true, requiresVerification: true, userId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/dev-email-login  (login con email y contraseña)
router.post("/dev-email-login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email y contraseña requeridos" });

    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    // Verificar contraseña
    if (user.password) {
        const bcrypt = await import("bcryptjs");
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid)
        return res
          .status(401)
          .json({
            error: "Credenciales incorrectas. Verifica tu correo y contraseña.",
          });
    } else {
      return res
        .status(401)
        .json({
          error:
            "Esta cuenta no tiene contraseña configurada. Inicia sesión con código SMS.",
        });
    }

    const token = signToken(user.id);
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        phoneVerified: user.phoneVerified,
      },
    });
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

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    const token = signToken(user.id);
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        phoneVerified: user.phoneVerified,
        biometricEnabled: user.biometricEnabled,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/enable-biometric
router.post("/enable-biometric", authenticateToken, async (req, res) => {
  try {
    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    await db
      .update(users)
      .set({ biometricEnabled: true } as any)
      .where(eq(users.id, req.user!.id));
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
    await db
      .update(users)
      .set({ biometricEnabled: false } as any)
      .where(eq(users.id, req.user!.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/auth/change-password
router.put("/change-password", authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: "Faltan campos" });
    if (newPassword.length < 8)
      return res
        .status(400)
        .json({ error: "La contraseña debe tener al menos 8 caracteres" });

    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const bcrypt = await import("bcryptjs");

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user!.id))
      .limit(1);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    if (user.password) {
      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid)
        return res
          .status(401)
          .json({ success: false, error: "Contraseña actual incorrecta" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await db
      .update(users)
      .set({ password: hashed } as any)
      .where(eq(users.id, req.user!.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/auth/change-phone  (requiere verificar nuevo número con OTP)
router.put("/change-phone", authenticateToken, async (req, res) => {
  try {
    const { newPhone, code } = req.body;
    if (!newPhone || !code)
      return res.status(400).json({ error: "Faltan campos" });

    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.phone, newPhone))
      .limit(1);
    if (existing && existing.id !== req.user!.id)
      return res.status(400).json({ error: "Ese teléfono ya está en uso" });

    const { verifyCode } = await import("../smsService");
    const isValid = await verifyCode(newPhone, code);
    if (!isValid) return res.status(400).json({ error: "Código inválido" });

    await db
      .update(users)
      .set({ phone: newPhone } as any)
      .where(eq(users.id, req.user!.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/logout
router.post("/logout", authenticateToken, async (req, res) => {
  res.json({ success: true, message: "Sesión cerrada" });
});

// DELETE /api/auth/account — eliminar cuenta permanentemente
router.delete("/account", authenticateToken, async (req, res) => {
  try {
    const { users, orders, addresses, favorites, businesses, deliveryDrivers } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq } = await import("drizzle-orm");

    const userId = req.user!.id;

    // Obtener datos del usuario antes de eliminar
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId as string))
      .limit(1);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    // Si es business_owner, desactivar sus negocios (no eliminar por integridad referencial)
    if (user.role === "business_owner") {
      const ownerBusinesses = await db
        .select()
        .from(businesses)
        .where(eq(businesses.ownerId, userId as string));
      for (const biz of ownerBusinesses) {
        await db
          .update(businesses)
          .set({ isActive: false, isOpen: false })
          .where(eq(businesses.id, biz.id as string));
      }
    }

    // Si es delivery_driver, eliminar registro de deliveryDrivers
    if (user.role === "delivery_driver") {
      await db
        .delete(deliveryDrivers)
        .where(eq(deliveryDrivers.userId, userId as string))
        .catch(() => {});
    }

    // Anonimizar pedidos (conservar por obligación legal pero sin datos personales)
    await db
      .update(orders)
      .set({
        deliveryAddress: null,
        notes: "[Usuario eliminado]",
      } as any)
      .where(eq(orders.userId, userId as string))
      .catch(() => {});

    // Eliminar direcciones
    await db
      .delete(addresses)
      .where(eq(addresses.userId, userId as string))
      .catch(() => {});

    // Eliminar favoritos
    await db
      .delete(favorites)
      .where(eq(favorites.userId, userId as string))
      .catch(() => {});

    // Marcar usuario como eliminado (soft-delete) preservando registros financieros
    await db
      .update(users)
      .set({
        isActive: false,
        name: "[Cuenta eliminada]",
        email: null,
        phone: `deleted_${userId}`,
        profileImage: null,
        address: null,
        dni: null,
        password: null,
        pushToken: null,
        biometricEnabled: false,
        updatedAt: new Date(),
      } as any)
      .where(eq(users.id, userId as string));

    res.json({
      success: true,
      message: "Cuenta eliminada correctamente. Todos tus datos personales han sido eliminados.",
    });
  } catch (error: any) {
    console.error("Delete account error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/auth/me
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user!.id))
      .limit(1);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        profileImage: user.profileImage,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
