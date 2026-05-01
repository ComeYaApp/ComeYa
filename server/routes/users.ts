import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { eq } from "drizzle-orm";
import { db } from "../db";

const router = express.Router();

// PUT /api/users/push-token — registrar Expo push token
router.put("/push-token", authenticateToken, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token || !token.startsWith("ExponentPushToken[")) {
      return res.status(400).json({ error: "Token inválido" });
    }
    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    await db.update(users).set({ pushToken: token, updatedAt: new Date() }).where(eq(users.id, req.user!.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/users/profile/full — perfil completo con datos de delivery_drivers
router.get("/profile/full", authenticateToken, async (req, res) => {
  try {
    const { users, deliveryDrivers } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const [user] = await db.select().from(users).where(eq(users.id, req.user!.id)).limit(1);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    let vehicleType = null, vehiclePlate = null, vehiclePhoto = null;
    let vehicleBrand = null, vehicleModel = null, vehicleColor = null, vehicleYear = null;
    let vehiclePlatePhoto = null, vehicleItvPhoto = null, vehicleInsurancePhoto = null, vehicleLicensePhoto = null;

    if (user.role === "delivery_driver") {
      const [dd] = await db.select().from(deliveryDrivers).where(eq(deliveryDrivers.userId, user.id)).limit(1);
      vehicleType          = dd?.vehicleType          ?? null;
      vehiclePlate         = dd?.vehiclePlate         ?? null;
      vehiclePhoto         = dd?.vehiclePhoto         ?? null;
      vehicleBrand         = dd?.vehicleBrand         ?? null;
      vehicleModel         = dd?.vehicleModel         ?? null;
      vehicleColor         = dd?.vehicleColor         ?? null;
      vehicleYear          = (dd as any)?.vehicleYear          ?? null;
      vehiclePlatePhoto    = (dd as any)?.vehiclePlatePhoto    ?? null;
      vehicleItvPhoto      = (dd as any)?.vehicleItvPhoto      ?? null;
      vehicleInsurancePhoto= (dd as any)?.vehicleInsurancePhoto?? null;
      vehicleLicensePhoto  = (dd as any)?.vehicleLicensePhoto  ?? null;
    }

    res.json({
      success: true,
      dni: user.dni,
      address: user.address,
      vehicleType, vehiclePlate, vehiclePhoto,
      vehicleBrand, vehicleModel, vehicleColor, vehicleYear,
      vehiclePlatePhoto, vehicleItvPhoto, vehicleInsurancePhoto, vehicleLicensePhoto,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/users/vehicle — actualizar datos del vehículo del repartidor
router.put("/vehicle", authenticateToken, async (req, res) => {
  try {
    const { deliveryDrivers } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { CloudinaryService } = await import("../cloudinaryService");

    const {
      vehicleType, vehiclePlate, vehicleBrand, vehicleModel, vehicleColor, vehicleYear,
      vehiclePlatePhoto, vehicleItvPhoto, vehicleInsurancePhoto, vehicleLicensePhoto,
    } = req.body;

    const updates: any = {};
    if (vehicleType  !== undefined) updates.vehicleType  = vehicleType  || null;
    if (vehiclePlate !== undefined) updates.vehiclePlate = vehiclePlate || null;
    if (vehicleBrand !== undefined) updates.vehicleBrand = vehicleBrand || null;
    if (vehicleModel !== undefined) updates.vehicleModel = vehicleModel || null;
    if (vehicleColor !== undefined) updates.vehicleColor = vehicleColor || null;
    if (vehicleYear  !== undefined) updates.vehicleYear  = vehicleYear  || null;

    // Subir fotos de documentos a Cloudinary si son base64
    const uploadDoc = async (b64: string | undefined, key: string) => {
      if (!b64) return undefined;
      if (b64.startsWith("data:image/")) {
        return await CloudinaryService.uploadImage(b64, "profiles", `driver-${req.user!.id}-${key}`);
      }
      return b64; // ya es URL
    };

    const plateUrl    = await uploadDoc(vehiclePlatePhoto,    "plate");
    const itvUrl      = await uploadDoc(vehicleItvPhoto,      "itv");
    const insuranceUrl= await uploadDoc(vehicleInsurancePhoto,"insurance");
    const licenseUrl  = await uploadDoc(vehicleLicensePhoto,  "license");

    if (plateUrl     !== undefined) updates.vehiclePlatePhoto     = plateUrl;
    if (itvUrl       !== undefined) updates.vehicleItvPhoto       = itvUrl;
    if (insuranceUrl !== undefined) updates.vehicleInsurancePhoto = insuranceUrl;
    if (licenseUrl   !== undefined) updates.vehicleLicensePhoto   = licenseUrl;

    const [existing] = await db.select().from(deliveryDrivers).where(eq(deliveryDrivers.userId, req.user!.id)).limit(1);
    if (existing) {
      await db.update(deliveryDrivers).set(updates).where(eq(deliveryDrivers.userId, req.user!.id));
    } else {
      await db.insert(deliveryDrivers).values({ id: crypto.randomUUID(), userId: req.user!.id, ...updates });
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get user profile
router.get("/profile", authenticateToken, async (req, res) => {
  try {
    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user!.id))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        profileImage: user.profileImage,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get user by ID (for driver photo, etc)
router.get("/:userId", authenticateToken, async (req, res) => {
  try {
    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.params.userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        profilePicture: user.profileImage,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    console.error("Get user error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update user profile
router.put("/profile", authenticateToken, async (req, res) => {
  try {
    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    
    const { name, email, profileImage, dni, address, phone } = req.body;
    
    const updates: any = {};
    if (name) updates.name = name;
    if (phone !== undefined) updates.phone = phone || null;
    if (email !== undefined) updates.email = email || null;
    if (profileImage) updates.profileImage = profileImage;
    if (dni !== undefined) updates.dni = dni || null;
    if (address !== undefined) updates.address = address || null;
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No hay datos para actualizar" });
    }

    updates.updatedAt = new Date();

    await db
      .update(users)
      .set(updates)
      .where(eq(users.id, req.user!.id));

    res.json({ success: true, message: "Perfil actualizado" });
  } catch (error: any) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Upload profile image — sube a Cloudinary
router.post("/profile-image", authenticateToken, async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) return res.status(400).json({ error: "Imagen requerida" });
    if (!image.startsWith('data:image/')) return res.status(400).json({ error: "Formato de imagen inválido" });

    // Límite 2MB
    const estimatedBytes = Math.ceil(image.length * 0.75);
    if (estimatedBytes > 2 * 1024 * 1024) {
      return res.status(400).json({ error: "La imagen es muy pesada. Máximo 2MB" });
    }

    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { CloudinaryService } = await import("../cloudinaryService");

    // Eliminar imagen anterior si existe
    const [currentUser] = await db.select().from(users).where(eq(users.id, req.user!.id)).limit(1);
    if (currentUser?.profileImage && currentUser.profileImage.includes('cloudinary')) {
      const oldPublicId = CloudinaryService.extractPublicId(currentUser.profileImage);
      if (oldPublicId) await CloudinaryService.deleteImage(oldPublicId).catch(() => {});
    }

    // Subir nueva imagen
    const imageUrl = await CloudinaryService.uploadImage(image, 'profiles', `user-${req.user!.id}`);
    await db.update(users).set({ profileImage: imageUrl }).where(eq(users.id, req.user!.id));

    res.json({ success: true, profileImage: imageUrl, message: "Imagen actualizada" });
  } catch (error: any) {
    console.error("Upload image error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Addresses — GET /addresses o GET /:userId/addresses
const getAddresses = async (req: any, res: any) => {
  try {
    const { addresses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const userId = req.params.id || req.user!.id;
    const list = await db.select().from(addresses).where(eq(addresses.userId, userId));
    res.json({ success: true, addresses: list });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
};

router.get("/addresses", authenticateToken, getAddresses);
router.get("/:id/addresses", authenticateToken, getAddresses);

// POST /addresses o POST /:userId/addresses
const postAddress = async (req: any, res: any) => {
  try {
    const { addresses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const userId = req.params.id || req.user!.id;
    const { label, street, city, state, zipCode, latitude, longitude, isDefault } = req.body;
    if (!label || !street) return res.status(400).json({ error: "label y street son requeridos" });

    // Si isDefault, quitar default de las demás
    if (isDefault) {
      await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, userId));
    }

    const id = crypto.randomUUID();
    await db.insert(addresses).values({
      id,
      userId,
      label,
      street,
      city: city || "Soria",
      state: state || "Castilla y León",
      zipCode: zipCode || null,
      latitude: latitude ? String(latitude) : null,
      longitude: longitude ? String(longitude) : null,
      isDefault: isDefault || false,
    });

    const [saved] = await db.select().from(addresses).where(eq(addresses.id, id)).limit(1);
    res.json({ success: true, address: saved });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
};

router.post("/addresses", authenticateToken, postAddress);
router.post("/:id/addresses", authenticateToken, postAddress);

// PUT /:userId/addresses/:addressId
router.put("/:id/addresses/:addressId", authenticateToken, async (req, res) => {
  try {
    const { addresses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { label, street, city, state, zipCode, latitude, longitude, isDefault } = req.body;
    const updates: any = {};
    if (label) updates.label = label;
    if (street) updates.street = street;
    if (city) updates.city = city;
    if (state) updates.state = state;
    if (zipCode !== undefined) updates.zipCode = zipCode;
    if (latitude !== undefined) updates.latitude = String(latitude);
    if (longitude !== undefined) updates.longitude = String(longitude);
    if (isDefault !== undefined) updates.isDefault = isDefault;
    await db.update(addresses).set(updates).where(eq(addresses.id, req.params.addressId));
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// DELETE /:userId/addresses/:addressId
router.delete("/:id/addresses/:addressId", authenticateToken, async (req, res) => {
  try {
    const { addresses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    await db.delete(addresses).where(eq(addresses.id, req.params.addressId));
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// Add user address
router.post("/addresses", authenticateToken, async (req, res) => {
  try {
    const { address, label, isDefault } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: "Dirección requerida" });
    }

    // For now, just return success - implement address storage later
    res.json({ 
      success: true, 
      message: "Dirección guardada",
      address: {
        id: crypto.randomUUID(),
        address,
        label: label || "Casa",
        isDefault: isDefault || false,
      }
    });
  } catch (error: any) {
    console.error("Add address error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get user stats (for admin)
router.get("/stats", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { users, orders } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { sql } = await import("drizzle-orm");
    
    const [userCount] = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
    const [orderCount] = await db.execute(sql`SELECT COUNT(*) as count FROM orders`);
    const [activeUsers] = await db.execute(sql`
      SELECT COUNT(DISTINCT userId) as count 
      FROM orders 
      WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);

    res.json({
      success: true,
      stats: {
        totalUsers: userCount.count,
        totalOrders: orderCount.count,
        activeUsers: activeUsers.count,
      },
    });
  } catch (error: any) {
    console.error("Get user stats error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /:userId/verification-documents — guardar URLs de documentos de identidad
router.post("/:id/verification-documents", authenticateToken, async (req, res) => {
  try {
    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const userId = req.params.id;

    const { idDocumentUrl, autonomoDocumentUrl } = req.body;
    const updates: any = { verificationStatus: "pending" };
    if (idDocumentUrl) updates.idDocumentUrl = idDocumentUrl;
    if (autonomoDocumentUrl) updates.autonomoDocumentUrl = autonomoDocumentUrl;

    await db.update(users).set(updates).where(eq(users.id, userId));
    res.json({ success: true, message: "Documentos recibidos. Tu cuenta está en revisión." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/users/:id/verification-status
router.get("/:id/verification-status", authenticateToken, async (req, res) => {
  try {
    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const [user] = await db.select({ verificationStatus: users.verificationStatus, verificationNotes: users.verificationNotes })
      .from(users).where(eq(users.id, req.params.id)).limit(1);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ success: true, ...user });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/users/change-phone — solicitar cambio de teléfono via OTP
router.post("/change-phone", authenticateToken, async (req, res) => {
  try {
    const { newPhone } = req.body;
    if (!newPhone) return res.status(400).json({ error: "Teléfono requerido" });

    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    // Verificar que no esté en uso
    const [existing] = await db.select().from(users).where(eq(users.phone, newPhone)).limit(1);
    if (existing && existing.id !== req.user!.id) {
      return res.status(400).json({ error: "Este teléfono ya está registrado" });
    }

    // Enviar OTP al nuevo teléfono via Twilio
    const twilio = require("twilio")(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await twilio.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID).verifications.create({
      to: newPhone,
      channel: "sms",
    });

    res.json({ success: true, message: "Código enviado al nuevo teléfono" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/users/verify-phone-change — verificar OTP y confirmar cambio
router.post("/verify-phone-change", authenticateToken, async (req, res) => {
  try {
    const { newPhone, code } = req.body;
    if (!newPhone || !code) return res.status(400).json({ error: "Teléfono y código requeridos" });

    const twilio = require("twilio")(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const check = await twilio.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID).verificationChecks.create({
      to: newPhone,
      code,
    });

    if (check.status !== "approved") {
      return res.status(400).json({ error: "Código incorrecto" });
    }

    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    await db.update(users).set({ phone: newPhone, updatedAt: new Date() }).where(eq(users.id, req.user!.id));

    res.json({ success: true, message: "Teléfono actualizado correctamente" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;