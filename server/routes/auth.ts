import express from "express";
import { authenticateToken } from "../authMiddleware";
import { eq, sql } from "drizzle-orm";
import jwt from "jsonwebtoken";

const router = express.Router();

const signToken = (userId: string, role?: string) =>
  jwt.sign(
    { id: userId, ...(role ? { role } : {}) },
    process.env.JWT_SECRET || "comeya_local_secret_key",
    { expiresIn: "7d" },
  );

// Normaliza el teléfono para login/registro: quita espacios y guiones,
// "00" → "+" y antepone +34 a móviles españoles de 9 dígitos. Los números
// con otros prefijos (p.ej. +58) se conservan tal cual, solo sin formato.
export function normalizePhone(raw: string): string {
  if (!raw) return "";
  let p = raw.trim().replace(/[\s\-().]/g, "");
  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (/^34[67]\d{8}$/.test(p)) p = "+" + p;
  if (/^[6789]\d{8}$/.test(p)) p = "+34" + p;
  return p;
}

// Rangos para elegir la fila correcta cuando hay candidatos con el mismo
// teléfono: las cuentas de repartidor/negocio/admin pesan más que la de
// cliente (una cuenta duplicada de cliente no debe "robar" el login).
const ROLE_RANK: Record<string, number> = {
  super_admin: 4,
  admin: 3,
  business_owner: 2,
  delivery_driver: 2,
  delivery: 2,
  business: 2,
  driver: 2,
  customer: 0,
};

// Busca el usuario por teléfono normalizado aunque en BD esté guardado con
// otro formato (espacios/guiones). Devuelve la mejor fila si hay duplicados.
async function findUserByPhone(db: any, users: any, rawPhone: string) {
  const phoneNorm = normalizePhone(rawPhone);
  const candidates = await db
    .select()
    .from(users)
    .where(
      sql`REPLACE(REPLACE(REPLACE(phone,' ',''),'-',''),'.','') = ${phoneNorm.replace(/[^+\d]/g, "")}`,
    );
  if (candidates.length === 0) {
    return null;
  }
  return candidates.sort((a: any, b: any) => {
    const ra = ROLE_RANK[a.role] ?? 0;
    const rb = ROLE_RANK[b.role] ?? 0;
    if (ra !== rb) return rb - ra;
    return (
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  })[0];
}

// Emitir par access + refresh: el access caduca (7 días) y el refresh queda
// guardado en BD para renovarlo sin volver a verificar el teléfono.
async function issueTokenPair(user: any) {
  const token = signToken(user.id, user.role);
  try {
    const { generateRefreshToken, storeRefreshToken } = await import(
      "../refreshTokenService"
    );
    const payload = {
      id: user.id,
      userId: user.id,
      phone: user.phone,
      role: user.role,
    };
    const refreshToken = generateRefreshToken(payload as any);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);
    await storeRefreshToken(user.id, refreshToken, expiresAt);
    return { token, refreshToken };
  } catch (e) {
    // Si falla el refresh no debe romper el login
    console.error("No se pudo emitir el refresh token:", e);
    return { token, refreshToken: null };
  }
}

// POST /api/auth/refresh — renueva el access token con un refresh válido.
// Sin este endpoint, al caducar el token el cliente borraba la sesión local
// y el panel del negocio quedaba vacío hasta volver a entrar.
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token requerido" });
    }
    const { rotateRefreshToken } = await import("../refreshTokenService");
    const result = await rotateRefreshToken(refreshToken);
    if (!result) {
      return res
        .status(401)
        .json({ error: "Refresh token inválido o expirado" });
    }
    res.json({
      success: true,
      token: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/send-code  (inicia login por teléfono O reenvía código)
router.post("/send-code", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Teléfono requerido" });

    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const user = await findUserByPhone(db, users, phone);

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
    const { normalizeRole } = await import("../authMiddleware");

    // Buscar por teléfono normalizado: si en BD está guardado con otro
    // formato, se encuentra igual y NO se crea una cuenta duplicada.
    let user = await findUserByPhone(db, users, phone);

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
          phone: normalizePhone(phone),
          name: signupData.name,
          email: signupData.email || null,
          password: hashedPassword,
          role: signupData.role || "customer",
          isActive: signupData.role === "customer" ? true : false, // Solo clientes activos inmediatamente
          phoneVerified: true,
          createdAt: new Date(),
        };
        // Referido: atribuir la invitación si el código es válido
        if (signupData.referralCode) {
          try {
            const { ReferralService } = await import("../referralService");
            const inviterId = await ReferralService.resolveReferralCode(
              signupData.referralCode,
            );
            if (inviterId) newUser.referredBy = inviterId;
          } catch {
            /* el referido es opcional: no bloquear el registro */
          }
        }
        await db.insert(users).values(newUser);
        user = newUser;

        // Avisar al admin de cada registro nuevo (cliente, negocio o
        // repartidor) para que tenga visibilidad en tiempo real
        try {
          const { recordAdminNotification } = await import(
            "../adminNotificationService"
          );
          const roleLabel =
            newUser.role === "delivery_driver"
              ? "repartidor"
              : newUser.role === "business_owner"
                ? "negocio"
                : "cliente";
          await recordAdminNotification({
            type: "new_registration",
            severity: "medium",
            title: `👤 Nuevo ${roleLabel} registrado`,
            body: `${newUser.name} se registró en la plataforma`,
            section: "users",
            data: { userId: newUser.id, role: newUser.role },
            entityKey: `reg:${newUser.id}`,
          });
        } catch {
          /*silencioso*/
        }
      } else {
        // Login normal sin signup previo
        const newUser: any = {
          id: crypto.randomUUID(),
          phone: normalizePhone(phone),
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
      // Usuario existe: marcar teléfono verificado. No se reactiva la cuenta
      // de un usuario rechazado (el admin la desactivó a propósito) ni se
      // toca su estado de verificación.
      const updates: any = { phoneVerified: true };
      if (user.verificationStatus !== "rejected") updates.isActive = true;
      await db
        .update(users)
        .set(updates)
        .where(eq(users.id, user.id));
      user.phoneVerified = true;
      if (user.verificationStatus !== "rejected") user.isActive = true;
    }

    const { token, refreshToken } = await issueTokenPair(user);
    res.json({
      success: true,
      token,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: normalizeRole(user.role),
        isActive: user.isActive,
        verificationStatus: (user as any).verificationStatus ?? "pending",
        phoneVerified: user.phoneVerified,
        profileImage: (user as any).profileImage || null,
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

    const existing = await findUserByPhone(db, users, phone);
    if (existing) {
      // Si la cuenta existe pero NO está verificada ni activa, permitir re-registro
      if (!existing.phoneVerified && !existing.isActive) {
        console.log(`🔄 Re-registro permitido para teléfono no verificado: ${phone} (userId: ${existing.id})`);
        // Mantener datos existentes, no borrar name (no permite NULL en MySQL)
        await db
          .update(users)
          .set({ 
            email: null as any, 
            password: null as any,
            role: (role || "customer") as any,
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
        phone: normalizePhone(phone),
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

// POST /api/auth/dev-login — helper SOLO para desarrollo y tests.
// En producción responde 404. Minta un JWT para el userId indicado.
router.post("/dev-login", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ error: "Not found" });
  }
  try {
    const { userId } = req.body;
    if (!userId)
      return res.status(400).json({ error: "userId requerido" });

    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
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
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        verificationStatus: (user as any).verificationStatus ?? "pending",
        phoneVerified: user.phoneVerified,
        profileImage: (user as any).profileImage || null,
      },
    });
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
        verificationStatus: (user as any).verificationStatus ?? "pending",
        phoneVerified: user.phoneVerified,
        profileImage: (user as any).profileImage || null,
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

    const { token, refreshToken } = await issueTokenPair(user);
    res.json({
      success: true,
      token,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        verificationStatus: (user as any).verificationStatus ?? "pending",
        phoneVerified: user.phoneVerified,
        biometricEnabled: user.biometricEnabled,
        profileImage: (user as any).profileImage || null,
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
  try {
    const { revokeAllUserTokens } = await import("../refreshTokenService");
    await revokeAllUserTokens(req.user!.id);
  } catch {}
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
        verificationStatus: (user as any).verificationStatus ?? "pending",
        profileImage: user.profileImage,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
