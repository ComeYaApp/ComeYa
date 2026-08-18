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
    await db
      .update(users)
      .set({ pushToken: token, updatedAt: new Date() })
      .where(eq(users.id, req.user!.id as string));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/users/notification-preferences — preferencias de notificaciones
router.get("/notification-preferences", authenticateToken, async (req, res) => {
  try {
    const { users } = await import("@shared/schema-mysql");
    const [user] = await db
      .select({ notificationPreferences: users.notificationPreferences })
      .from(users)
      .where(eq(users.id, req.user!.id as string))
      .limit(1);
    if (!user)
      return res.status(404).json({ error: "Usuario no encontrado" });

    let prefs = { promotions: true, news: true };
    if (user.notificationPreferences) {
      try {
        const parsed = JSON.parse(user.notificationPreferences);
        prefs = {
          promotions:
            typeof parsed.promotions === "boolean"
              ? parsed.promotions
              : true,
          news: typeof parsed.news === "boolean" ? parsed.news : true,
        };
      } catch {
        /* JSON inválido: usar valores por defecto */
      }
    }
    res.json({ success: true, preferences: prefs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/users/notification-preferences — guardar preferencias
router.put("/notification-preferences", authenticateToken, async (req, res) => {
  try {
    const { promotions, news } = req.body || {};
    const prefs = {
      promotions: promotions !== false,
      news: news !== false,
    };
    const { users } = await import("@shared/schema-mysql");
    await db
      .update(users)
      .set({ notificationPreferences: JSON.stringify(prefs) })
      .where(eq(users.id, req.user!.id as string));
    res.json({ success: true, preferences: prefs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/users/profile/full — perfil completo con datos de delivery_drivers
router.get("/profile/full", authenticateToken, async (req, res) => {
  try {
    const { users, deliveryDrivers } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user!.id as string))
      .limit(1);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    let vehicleType = null,
      vehiclePlate = null,
      vehiclePhoto = null;
    let vehicleBrand = null,
      vehicleModel = null,
      vehicleColor = null,
      vehicleYear = null;
    let vehiclePlatePhoto = null,
      vehicleItvPhoto = null,
      vehicleInsurancePhoto = null,
      vehicleLicensePhoto = null;

    if (user.role === "delivery_driver") {
      const [dd] = await db
        .select()
        .from(deliveryDrivers)
        .where(eq(deliveryDrivers.userId, user.id as string))
        .limit(1);
      vehicleType = dd?.vehicleType ?? null;
      vehiclePlate = dd?.vehiclePlate ?? null;
      vehiclePhoto = dd?.vehiclePhoto ?? null;
      vehicleBrand = dd?.vehicleBrand ?? null;
      vehicleModel = dd?.vehicleModel ?? null;
      vehicleColor = dd?.vehicleColor ?? null;
      vehicleYear = (dd as any)?.vehicleYear ?? null;
      vehiclePlatePhoto = (dd as any)?.vehiclePlatePhoto ?? null;
      vehicleItvPhoto = (dd as any)?.vehicleItvPhoto ?? null;
      vehicleInsurancePhoto = (dd as any)?.vehicleInsurancePhoto ?? null;
      vehicleLicensePhoto = (dd as any)?.vehicleLicensePhoto ?? null;
    }

    res.json({
      success: true,
      dni: user.dni,
      address: user.address,
      verificationStatus: user.verificationStatus,
      isActive: user.isActive,
      vehicleType,
      vehiclePlate,
      vehiclePhoto,
      vehicleBrand,
      vehicleModel,
      vehicleColor,
      vehicleYear,
      vehiclePlatePhoto,
      vehicleItvPhoto,
      vehicleInsurancePhoto,
      vehicleLicensePhoto,
      idDocumentUrl: user.idDocumentUrl,
      idDocumentBackUrl: (user as any).idDocumentBackUrl,
      autonomoDocumentUrl: user.autonomoDocumentUrl,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/user/profile-image — subir foto de perfil a Cloudinary
// El cliente llama a POST /api/user/profile-image con { image: "data:image/..." }
router.post("/profile-image", authenticateToken, async (req, res) => {
  try {
    const { image } = req.body;
    if (!image || !image.startsWith("data:image/")) {
      return res.status(400).json({ error: "Imagen en base64 requerida (data:image/...)" });
    }

    const { CloudinaryService } = await import("../cloudinaryService");
    const profileImageUrl = await CloudinaryService.uploadImage(
      image,
      "profiles",
      `user-${req.user!.id}`,
    );

    // Actualizar el campo profileImage en la base de datos
    const { users } = await import("@shared/schema-mysql");
    await db
      .update(users)
      .set({ profileImage: profileImageUrl, updatedAt: new Date() })
      .where(eq(users.id, req.user!.id as string));

    res.json({
      success: true,
      profileImage: profileImageUrl,
      message: "Foto de perfil actualizada correctamente",
    });
  } catch (error: any) {
    console.error("Profile image upload error:", error);
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
      vehicleType,
      vehiclePlate,
      vehicleBrand,
      vehicleModel,
      vehicleColor,
      vehicleYear,
      vehiclePhoto,
      vehiclePlatePhoto,
      vehicleItvPhoto,
      vehicleInsurancePhoto,
      vehicleLicensePhoto,
      deleteVehiclePhoto,
      deleteVehiclePlatePhoto,
      deleteVehicleItvPhoto,
      deleteVehicleInsurancePhoto,
      deleteVehicleLicensePhoto,
    } = req.body;

    const updates: any = {};
    if (vehicleType !== undefined) updates.vehicleType = vehicleType || null;
    if (vehiclePlate !== undefined) updates.vehiclePlate = vehiclePlate || null;
    if (vehicleBrand !== undefined) updates.vehicleBrand = vehicleBrand || null;
    if (vehicleModel !== undefined) updates.vehicleModel = vehicleModel || null;
    if (vehicleColor !== undefined) updates.vehicleColor = vehicleColor || null;
    if (vehicleYear !== undefined) updates.vehicleYear = vehicleYear || null;

    // Subir fotos de documentos a Cloudinary si son base64
    const uploadDoc = async (b64: string | undefined, key: string) => {
      if (!b64) return undefined;
      if (b64.startsWith("data:image/")) {
        return await CloudinaryService.uploadImage(
          b64,
          "profiles",
          `driver-${req.user!.id}-${key}`,
        );
      }
      return b64; // ya es URL
    };

    const photoUrl = await uploadDoc(vehiclePhoto, "photo");
    const plateUrl = await uploadDoc(vehiclePlatePhoto, "plate");
    const itvUrl = await uploadDoc(vehicleItvPhoto, "itv");
    const insuranceUrl = await uploadDoc(vehicleInsurancePhoto, "insurance");
    const licenseUrl = await uploadDoc(vehicleLicensePhoto, "license");

    // Handle deletes and updates
    if (deleteVehiclePhoto === true) updates.vehiclePhoto = null;
    else if (photoUrl !== undefined) updates.vehiclePhoto = photoUrl;

    if (deleteVehiclePlatePhoto === true) updates.vehiclePlatePhoto = null;
    else if (plateUrl !== undefined) updates.vehiclePlatePhoto = plateUrl;

    if (deleteVehicleItvPhoto === true) updates.vehicleItvPhoto = null;
    else if (itvUrl !== undefined) updates.vehicleItvPhoto = itvUrl;

    if (deleteVehicleInsurancePhoto === true)
      updates.vehicleInsurancePhoto = null;
    else if (insuranceUrl !== undefined)
      updates.vehicleInsurancePhoto = insuranceUrl;

    if (deleteVehicleLicensePhoto === true) updates.vehicleLicensePhoto = null;
    else if (licenseUrl !== undefined) updates.vehicleLicensePhoto = licenseUrl;

    const [existing] = await db
      .select()
      .from(deliveryDrivers)
      .where(eq(deliveryDrivers.userId, req.user!.id as string))
      .limit(1);
    if (existing) {
      await db
        .update(deliveryDrivers)
        .set(updates)
        .where(eq(deliveryDrivers.userId, req.user!.id as string));
    } else {
      await db
        .insert(deliveryDrivers)
        .values({ id: crypto.randomUUID(), userId: req.user!.id, ...updates });
    }

    // Cambios en documentos del vehículo → re-verificación del admin
    const docsChanged =
      photoUrl !== undefined ||
      plateUrl !== undefined ||
      itvUrl !== undefined ||
      insuranceUrl !== undefined ||
      licenseUrl !== undefined ||
      deleteVehiclePhoto === true ||
      deleteVehiclePlatePhoto === true ||
      deleteVehicleItvPhoto === true ||
      deleteVehicleInsurancePhoto === true ||
      deleteVehicleLicensePhoto === true;

    // Cambios en los datos del vehículo (tipo/matrícula/etc.) → también
    // requieren re-verificación, salvo el primer registro
    const infoChanged =
      !!existing &&
      ((updates.vehicleType !== undefined &&
        updates.vehicleType !== existing.vehicleType) ||
        (updates.vehiclePlate !== undefined &&
          updates.vehiclePlate !== existing.vehiclePlate) ||
        (updates.vehicleBrand !== undefined &&
          updates.vehicleBrand !== existing.vehicleBrand) ||
        (updates.vehicleModel !== undefined &&
          updates.vehicleModel !== existing.vehicleModel) ||
        (updates.vehicleColor !== undefined &&
          updates.vehicleColor !== existing.vehicleColor));

    if (docsChanged || infoChanged) {
      const { users } = await import("@shared/schema-mysql");
      await db
        .update(users)
        .set({ verificationStatus: "pending" })
        .where(eq(users.id, req.user!.id as string));
      try {
        const { notifyAdmins } = await import("../websocket");
        notifyAdmins({
          type: "driver_document_updated",
          userId: req.user!.id,
          document: "vehicle",
        });
      } catch {
        /* notificación opcional */
      }
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
      .where(eq(users.id, req.user!.id as string))
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
      .where(eq(users.id, req.params.userId as string))
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
      .where(eq(users.id, req.user!.id as string));

    // Sincronizar con tabla addresses si se envió dirección
    if (address) {
      const { addresses } = await import("@shared/schema-mysql");
      const existing = await db
        .select()
        .from(addresses)
        .where(eq(addresses.userId, req.user!.id as string))
        .limit(10);
      const defaultAddr =
        existing.find((a: { isDefault: boolean }) => a.isDefault) ||
        existing[0];
      if (defaultAddr) {
        await db
          .update(addresses)
          .set({ street: address })
          .where(eq(addresses.id, defaultAddr.id as string));
      } else {
        await db.insert(addresses).values({
          id: crypto.randomUUID(),
          userId: req.user!.id,
          label: "Casa",
          street: address,
          city: "Soria",
          state: "Castilla y León",
          isDefault: true,
        });
      }
    }

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
    if (!image.startsWith("data:image/"))
      return res.status(400).json({ error: "Formato de imagen inválido" });

    // Límite 2MB
    const estimatedBytes = Math.ceil(image.length * 0.75);
    if (estimatedBytes > 2 * 1024 * 1024) {
      return res
        .status(400)
        .json({ error: "La imagen es muy pesada. Máximo 2MB" });
    }

    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { CloudinaryService } = await import("../cloudinaryService");

    // Eliminar imagen anterior si existe
    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user!.id as string))
      .limit(1);
    if (
      currentUser?.profileImage &&
      currentUser.profileImage.includes("cloudinary")
    ) {
      const oldPublicId = CloudinaryService.extractPublicId(
        currentUser.profileImage,
      );
      if (oldPublicId)
        await CloudinaryService.deleteImage(oldPublicId).catch(() => {});
    }

    // Subir nueva imagen
    const imageUrl = await CloudinaryService.uploadImage(
      image,
      "profiles",
      `user-${req.user!.id}`,
    );
    await db
      .update(users)
      .set({ profileImage: imageUrl })
      .where(eq(users.id, req.user!.id as string));

    res.json({
      success: true,
      profileImage: imageUrl,
      message: "Imagen actualizada",
    });
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
    const role = req.user!.role;
    if (
      userId !== req.user!.id &&
      role !== "admin" &&
      role !== "super_admin"
    ) {
      return res
        .status(403)
        .json({ error: "No autorizado para ver estas direcciones" });
    }
    const list = await db
      .select()
      .from(addresses)
      .where(eq(addresses.userId, userId as string));
    res.json({ success: true, addresses: list });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

router.get("/addresses", authenticateToken, getAddresses);
router.get("/:id/addresses", authenticateToken, getAddresses);

// POST /addresses o POST /:userId/addresses
const postAddress = async (req: any, res: any) => {
  try {
    const { addresses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const userId = req.params.id || req.user!.id;
    if (!userId || userId === "undefined" || userId === "null") {
      return res.status(400).json({ error: "Usuario no autenticado" });
    }
    const role = req.user!.role;
    if (
      userId !== req.user!.id &&
      role !== "admin" &&
      role !== "super_admin"
    ) {
      return res
        .status(403)
        .json({ error: "No autorizado para crear direcciones de otro usuario" });
    }
    const {
      label,
      street,
      city,
      state,
      zipCode,
      latitude,
      longitude,
      isDefault,
    } = req.body;
    if (!label || !street)
      return res.status(400).json({ error: "label y street son requeridos" });

    // Si isDefault, quitar default de las demás
    if (isDefault) {
      await db
        .update(addresses)
        .set({ isDefault: false })
        .where(eq(addresses.userId, userId as string));
    }

    const id = crypto.randomUUID();
    await db.insert(addresses).values({
      id: id as string,
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

    const [saved] = await db
      .select()
      .from(addresses)
      .where(eq(addresses.id, id as string))
      .limit(1);
    res.json({ success: true, address: saved });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

router.post("/addresses", authenticateToken, postAddress);
router.post("/:id/addresses", authenticateToken, postAddress);

// PUT /:userId/addresses/:addressId
router.put("/:id/addresses/:addressId", authenticateToken, async (req, res) => {
  try {
    const { addresses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const role = req.user!.role;
    const [existing] = await db
      .select()
      .from(addresses)
      .where(eq(addresses.id, req.params.addressId as string))
      .limit(1);
    if (!existing) {
      return res.status(404).json({ error: "Dirección no encontrada" });
    }
    if (
      existing.userId !== req.user!.id &&
      role !== "admin" &&
      role !== "super_admin"
    ) {
      return res
        .status(403)
        .json({ error: "No autorizado para editar esta dirección" });
    }
    const {
      label,
      street,
      city,
      state,
      zipCode,
      latitude,
      longitude,
      isDefault,
    } = req.body;
    const updates: any = {};
    if (label) updates.label = label;
    if (street) updates.street = street;
    if (city) updates.city = city;
    if (state) updates.state = state;
    if (zipCode !== undefined) updates.zipCode = zipCode;
    if (latitude !== undefined) updates.latitude = String(latitude);
    if (longitude !== undefined) updates.longitude = String(longitude);
    if (isDefault !== undefined) updates.isDefault = isDefault;
    await db
      .update(addresses)
      .set(updates)
      .where(eq(addresses.id, req.params.addressId as string));
    const [updated] = await db
      .select()
      .from(addresses)
      .where(eq(addresses.id, req.params.addressId as string))
      .limit(1);
    res.json({ success: true, address: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /:userId/addresses/:addressId
router.delete(
  "/:id/addresses/:addressId",
  authenticateToken,
  async (req, res) => {
    try {
      const { addresses } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const role = req.user!.role;
      const [existing] = await db
        .select()
        .from(addresses)
        .where(eq(addresses.id, req.params.addressId as string))
        .limit(1);
      if (!existing) {
        return res.status(404).json({ error: "Dirección no encontrada" });
      }
      if (
        existing.userId !== req.user!.id &&
        role !== "admin" &&
        role !== "super_admin"
      ) {
        return res
          .status(403)
          .json({ error: "No autorizado para eliminar esta dirección" });
      }
      await db
        .delete(addresses)
        .where(eq(addresses.id, req.params.addressId as string));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Get user stats (for admin)
router.get(
  "/stats",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { users, orders } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { sql } = await import("drizzle-orm");

      const [userCount] = await db.execute(
        sql`SELECT COUNT(*) as count FROM users`,
      );
      const [orderCount] = await db.execute(
        sql`SELECT COUNT(*) as count FROM orders`,
      );
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
  },
);

// POST /:userId/verification-documents — guardar URLs de documentos de identidad
router.post(
  "/:id/verification-documents",
  authenticateToken,
  async (req, res) => {
    try {
      const { users } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const userId = req.params.id;

      const { idDocumentUrl, autonomoDocumentUrl } = req.body;
      const updates: any = { verificationStatus: "pending" };
      if (idDocumentUrl) updates.idDocumentUrl = idDocumentUrl;
      if (autonomoDocumentUrl)
        updates.autonomoDocumentUrl = autonomoDocumentUrl;

      await db
        .update(users)
        .set(updates)
        .where(eq(users.id, userId as string));
      res.json({
        success: true,
        message: "Documentos recibidos. Tu cuenta está en revisión.",
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// GET /api/users/:id/verification-status
router.get("/:id/verification-status", authenticateToken, async (req, res) => {
  try {
    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const [user] = await db
      .select({
        verificationStatus: users.verificationStatus,
        verificationNotes: users.verificationNotes,
      })
      .from(users)
      .where(eq(users.id, req.params.id as string))
      .limit(1);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ success: true, ...user });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/users/:id/reset-verification — Reiniciar verificación para volver a subir documentos
router.post("/:id/reset-verification", authenticateToken, async (req, res) => {
  try {
    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq } = await import("drizzle-orm");

    const userId = req.params.id;

    // Verificar que el usuario que hace la petición es el mismo o es admin
    if (
      req.user!.id !== userId &&
      req.user!.role !== "admin" &&
      req.user!.role !== "super_admin"
    ) {
      return res
        .status(403)
        .json({ error: "No tienes permiso para hacer esto" });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId as string))
      .limit(1);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    // No permitir reset si ya está aprobado
    if (user.verificationStatus === "verified" && user.isActive) {
      return res
        .status(400)
        .json({
          error:
            "Tu cuenta ya está verificada. Contacta soporte para modificar tus documentos.",
        });
    }

    // Reiniciar estado de verificación
    await db
      .update(users)
      .set({
        verificationStatus: "pending" as any,
        verificationNotes: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId as string));

    res.json({
      success: true,
      message:
        "Verificación reiniciada. Por favor, envía tus documentos nuevamente.",
    });
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
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.phone, newPhone as string))
      .limit(1);
    if (existing && existing.id !== req.user!.id) {
      return res
        .status(400)
        .json({ error: "Este teléfono ya está registrado" });
    }

    // Enviar OTP al nuevo teléfono via Twilio
    const TwilioModule = await import("twilio");
    const TwilioClass = TwilioModule.default || TwilioModule;
    const twilio = TwilioClass(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );
    await twilio.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verifications.create({
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
    if (!newPhone || !code)
      return res.status(400).json({ error: "Teléfono y código requeridos" });

    const TwilioModule = await import("twilio");
    const TwilioClass = TwilioModule.default || TwilioModule;
    const twilio = TwilioClass(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );
    const check = await twilio.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks.create({
        to: newPhone,
        code,
      });

    if (check.status !== "approved") {
      return res.status(400).json({ error: "Código incorrecto" });
    }

    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    await db
      .update(users)
      .set({ phone: newPhone, updatedAt: new Date() })
      .where(eq(users.id, req.user!.id as string));

    res.json({ success: true, message: "Teléfono actualizado correctamente" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/users/verification-document — subir y guardar un documento de verificación
router.post("/verification-document", authenticateToken, async (req, res) => {
  try {
    const { key, image } = req.body;
    if (!key || !image)
      return res.status(400).json({ error: "key e image requeridos" });
    if (!image.startsWith("data:image/"))
      return res.status(400).json({ error: "Formato de imagen inválido" });

    const estimatedBytes = Math.ceil(image.length * 0.75);
    if (estimatedBytes > 5 * 1024 * 1024) {
      return res
        .status(400)
        .json({ error: "El archivo es muy pesado. Máximo 5MB" });
    }

    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { CloudinaryService } = await import("../cloudinaryService");

    // Upload to Cloudinary
    const url = await CloudinaryService.uploadImage(
      image,
      "verification-docs",
      `driver-${req.user!.id}-${key}`,
    );

    // Map document keys to database fields
    const fieldMap: Record<string, string> = {
      idDocument: "idDocumentUrl",
      idDocumentBack: "idDocumentBackUrl",
      autonomo: "autonomoDocumentUrl",
      vehicleLicense: "vehicleLicensePhoto",
      vehiclePlate: "vehiclePlatePhoto",
      vehicleItv: "vehicleItvPhoto",
      vehicleInsurance: "vehicleInsurancePhoto",
      vehiclePhoto: "vehiclePhoto",
    };

    const field = fieldMap[key];
    if (!field) {
      return res.status(400).json({ error: "Tipo de documento inválido" });
    }

    // Determine which table to update based on document type
    // (compara la CLAVE original, no el nombre de columna)
    const isVehicleDocument = [
      "vehicleLicense",
      "vehiclePlate",
      "vehicleItv",
      "vehicleInsurance",
      "vehiclePhoto",
    ].includes(key);

    if (isVehicleDocument) {
      // Update deliveryDrivers table for vehicle documents
      const { deliveryDrivers } = await import("@shared/schema-mysql");
      const [existing] = await db
        .select()
        .from(deliveryDrivers)
        .where(eq(deliveryDrivers.userId, req.user!.id as string))
        .limit(1);
      console.log("DEBUG existing driver:", !!existing, "field:", field);
      if (existing) {
        const updateQuery = db
          .update(deliveryDrivers)
          .set({ [field]: url, updatedAt: new Date() })
          .where(eq(deliveryDrivers.userId, req.user!.id as string));
        await updateQuery;
      } else {
        await db
          .insert(deliveryDrivers)
          .values({
            id: crypto.randomUUID(),
            userId: req.user!.id,
            [field]: url,
          });
      }
    } else {
      // Update users table for personal documents (idDocument, idDocumentBack, autonomo)
      await db
        .update(users)
        .set({
          [field]: url,
          verificationStatus: "pending",
          updatedAt: new Date(),
        })
        .where(eq(users.id, req.user!.id as string));
    }

    // Los documentos del vehículo también requieren re-verificación
    if (isVehicleDocument) {
      await db
        .update(users)
        .set({ verificationStatus: "pending" })
        .where(eq(users.id, req.user!.id as string));
    }

    // Avisar al admin para revisar la documentación
    try {
      const { notifyAdmins } = await import("../websocket");
      notifyAdmins({
        type: "driver_document_updated",
        userId: req.user!.id,
        document: key,
      });
    } catch {
      /* notificación opcional */
    }

    res.json({
      success: true,
      url,
      message: "Documento guardado correctamente",
    });
  } catch (error: any) {
    console.error("Verification document upload error:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/users/personal-docs — guardar documentos personales
router.put("/personal-docs", authenticateToken, async (req, res) => {
  try {
    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const {
      idDocumentUrl,
      idDocumentBackUrl,
      autonomoDocumentUrl,
      deleteIdDocumentUrl,
      deleteIdDocumentBackUrl,
      deleteAutonomoDocumentUrl,
    } = req.body;
    const updates: any = {
      verificationStatus: "pending",
      updatedAt: new Date(),
    };

    // Handle deletes (setting to empty string or null removes the document)
    if (deleteIdDocumentUrl === true) updates.idDocumentUrl = null;
    else if (idDocumentUrl) updates.idDocumentUrl = idDocumentUrl;

    if (deleteIdDocumentBackUrl === true) updates.idDocumentBackUrl = null;
    else if (idDocumentBackUrl) updates.idDocumentBackUrl = idDocumentBackUrl;

    if (deleteAutonomoDocumentUrl === true) updates.autonomoDocumentUrl = null;
    else if (autonomoDocumentUrl)
      updates.autonomoDocumentUrl = autonomoDocumentUrl;

    await db
      .update(users)
      .set(updates)
      .where(eq(users.id, req.user!.id as string));

    // Avisar al admin para la re-verificación
    try {
      const { notifyAdmins } = await import("../websocket");
      notifyAdmins({
        type: "driver_document_updated",
        userId: req.user!.id,
        document: "personal",
      });
    } catch {
      /* notificación opcional */
    }

    res.json({
      success: true,
      message: "Documentos guardados. Tu cuenta será revisada nuevamente.",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
