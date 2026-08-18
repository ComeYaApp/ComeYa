import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { db } from "../db";
import { users, deliveryDrivers } from "@shared/schema-mysql";
import { eq, and, desc, sql, or } from "drizzle-orm";
import { CloudinaryService } from "../cloudinaryService";

const router = express.Router();

// ==========================================
// TIPOS Y CONSTANTES
// ==========================================

type VerificationStatus = "pending" | "in_review" | "approved" | "rejected";

interface DeliveryVerification {
  userId: string;
  status: VerificationStatus;
  documents: {
    idDocumentUrl: boolean;
    idDocumentBackUrl: boolean;
    autonomoDocumentUrl: boolean;
    vehiclePhoto: boolean;
    vehiclePlatePhoto: boolean;
    vehicleItvPhoto: boolean;
    vehicleInsurancePhoto: boolean;
    vehicleLicensePhoto: boolean;
  };
  vehicleInfo: {
    vehicleType: string | null;
    vehiclePlate: string | null;
    vehicleBrand: string | null;
    vehicleModel: string | null;
    vehicleColor: string | null;
  };
  submittedAt: Date | null;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
}

// Documentos requeridos para verificación completa
const REQUIRED_DOCS = [
  "idDocumentUrl",
  "idDocumentBackUrl",
  "vehicleLicensePhoto",
  "vehiclePhoto",
];

// ==========================================
// RUTAS PÚBLICAS (ANTES DE AUTH PARA REGISTRO)
// ==========================================

// POST /api/delivery/verification/submit - Submit verification documents (puede ejecutarse sin auth si viene del registro)
router.post("/submit", async (req, res) => {
  try {
    // Permitir sin autenticación para registrations
    const authUser = req.user;
    const userId = req.body.userId || authUser?.id;

    if (!userId) {
      return res.status(400).json({ error: "userId requerido" });
    }

    const {
      // Document URLs (ya subidos a Cloudinary)
      idDocumentUrl,
      idDocumentBackUrl,
      autonomoDocumentUrl,
      vehiclePhoto,
      vehiclePlatePhoto,
      vehicleItvPhoto,
      vehicleInsurancePhoto,
      vehicleLicensePhoto,
      // Info del vehículo
      vehicleType,
      vehiclePlate,
      vehicleBrand,
      vehicleModel,
      vehicleColor,
    } = req.body;

    // Obtener usuario actual
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId as string))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // Verificar que sea driver o quiera ser driver
    if (user.role !== "delivery_driver" && !req.body.applyAsDriver) {
      // Actualizar rol a delivery_driver si aplica
      await db
        .update(users)
        .set({ role: "delivery_driver", verificationStatus: "pending" as any })
        .where(eq(users.id, userId as string));
    } else {
      // Solo actualizar verificación
      await db
        .update(users)
        .set({ verificationStatus: "pending" as any, updatedAt: new Date() })
        .where(eq(users.id, userId as string));
    }

    // Guardar URLs de documentos en users
    const userUpdates: any = { verificationStatus: "pending" };
    if (idDocumentUrl) userUpdates.idDocumentUrl = idDocumentUrl;
    if (idDocumentBackUrl) userUpdates.idDocumentBackUrl = idDocumentBackUrl;
    if (autonomoDocumentUrl)
      userUpdates.autonomoDocumentUrl = autonomoDocumentUrl;

    await db
      .update(users)
      .set(userUpdates)
      .where(eq(users.id, userId as string));

    // Buscar o crear registro en delivery_drivers
    const [existingDriver] = await db
      .select()
      .from(deliveryDrivers)
      .where(eq(deliveryDrivers.userId, userId as string))
      .limit(1);

    const driverUpdates: any = {
      vehicleType: vehicleType || null,
      vehiclePlate: vehiclePlate || null,
      vehicleBrand: vehicleBrand || null,
      vehicleModel: vehicleModel || null,
      vehicleColor: vehicleColor || null,
      vehiclePhoto: vehiclePhoto || null,
      vehiclePlatePhoto: vehiclePlatePhoto || null,
      vehicleItvPhoto: vehicleItvPhoto || null,
      vehicleInsurancePhoto: vehicleInsurancePhoto || null,
      vehicleLicensePhoto: vehicleLicensePhoto || null,
    };

    if (existingDriver) {
      await db
        .update(deliveryDrivers)
        .set(driverUpdates)
        .where(eq(deliveryDrivers.userId, userId as string));
    } else {
      await db.insert(deliveryDrivers).values({
        id: crypto.randomUUID(),
        userId,
        ...driverUpdates,
        isAvailable: false,
        currentLatitude: null,
        currentLongitude: null,
      } as any);
    }

    // Notificar al admin (en background)
    try {
      const { notifyAdmins } = await import("../websocket");
      notifyAdmins({
        type: "new_delivery_verification",
        userId,
        userName: user.name,
        message: `Nuevo repartidor pendiente de verificación: ${user.name}`,
      });
    } catch {
      /*silencioso*/
    }

    res.json({
      success: true,
      message: "Documentos enviados. Tu verificación está en revisión.",
      status: "pending",
    });
  } catch (error: any) {
    console.error("Error submitting verification:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// RUTAS AUTENTICADAS
// ==========================================

// GET /api/delivery/verification/status - Get current verification status
router.get("/status", authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const [driver] = await db
      .select()
      .from(deliveryDrivers)
      .where(eq(deliveryDrivers.userId, userId))
      .limit(1);

    // Determinar estado basado en documentos
    const docs = {
      idDocumentUrl: !!user.idDocumentUrl,
      idDocumentBackUrl: !!(user as any).idDocumentBackUrl,
      autonomoDocumentUrl: !!user.autonomoDocumentUrl,
      vehiclePhoto: !!driver?.vehiclePhoto,
      vehiclePlatePhoto: !!driver?.vehiclePlatePhoto,
      vehicleItvPhoto: !!driver?.vehicleItvPhoto,
      vehicleInsurancePhoto: !!driver?.vehicleInsurancePhoto,
      vehicleLicensePhoto: !!driver?.vehicleLicensePhoto,
    };

    const completeDocs = REQUIRED_DOCS.filter(
      (doc) => docs[doc as keyof typeof docs],
    );
    const isComplete = completeDocs.length === REQUIRED_DOCS.length;

    // Estado: pending (docs faltantes) | in_review (docs completos esperando) | approved (isActive true) | rejected
    let status: VerificationStatus = "pending";
    if (user.isActive && user.verificationStatus === "verified") {
      status = "approved";
    } else if (isComplete) {
      status = "in_review";
    }

    res.json({
      success: true,
      status,
      isComplete,
      missingDocuments: REQUIRED_DOCS.filter(
        (doc) => !docs[doc as keyof typeof docs],
      ),
      documents: docs,
      vehicleInfo: {
        vehicleType: driver?.vehicleType,
        vehiclePlate: driver?.vehiclePlate,
        vehicleBrand: driver?.vehicleBrand,
        vehicleModel: driver?.vehicleModel,
        vehicleColor: driver?.vehicleColor,
      },
      rejectionReason: (user as any).verificationNotes,
    });
  } catch (error: any) {
    console.error("Error getting verification status:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/delivery/verification/reset - Reset verification to re-submit documents
router.post("/reset", authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // No permitir reset si ya está aprobado y activo
    if (user.isActive && user.verificationStatus === "verified") {
      return res
        .status(400)
        .json({
          error:
            "Ya estás verificado. Contacta soporte para modificar tus documentos.",
        });
    }

    // Resetear estado
    await db
      .update(users)
      .set({
        verificationStatus: "pending" as any,
        verificationNotes: null,
      })
      .where(eq(users.id, userId));

    res.json({
      success: true,
      message:
        "Verificación reiniciada. Por favor, envía tus documentos nuevamente.",
    });
  } catch (error: any) {
    console.error("Error resetting verification:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// SUBIDA DE DOCUMENTOS
// ==========================================

// POST /api/delivery/verification/upload-document - Subir un documento específico
router.post("/upload-document", authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { documentType, image } = req.body;

    if (!documentType || !image) {
      return res.status(400).json({ error: "documentType e image requeridos" });
    }

    if (!image.startsWith("data:image/")) {
      return res.status(400).json({ error: "Formato de imagen inválido" });
    }

    // Validar tamaño (5MB max)
    const estimatedBytes = Math.ceil(image.length * 0.75);
    if (estimatedBytes > 5 * 1024 * 1024) {
      return res
        .status(400)
        .json({ error: "La imagen es muy pesada. Máximo 5MB" });
    }

    // mapping de campos
    const userFieldMap: Record<string, string> = {
      idDocumentUrl: "idDocumentUrl",
      idDocumentBackUrl: "idDocumentBackUrl",
      autonomoDocumentUrl: "autonomoDocumentUrl",
    };

    const driverFieldMap: Record<string, string> = {
      vehiclePhoto: "vehiclePhoto",
      vehiclePlatePhoto: "vehiclePlatePhoto",
      vehicleItvPhoto: "vehicleItvPhoto",
      vehicleInsurancePhoto: "vehicleInsurancePhoto",
      vehicleLicensePhoto: "vehicleLicensePhoto",
    };

    const isUserField = documentType in userFieldMap;
    const isDriverField = documentType in driverFieldMap;

    if (!isUserField && !isDriverField) {
      return res.status(400).json({ error: "Tipo de documento inválido" });
    }

    // Subir a Cloudinary
    const documentKey = isUserField
      ? userFieldMap[documentType]
      : driverFieldMap[documentType];
    const url = await CloudinaryService.uploadImage(
      image,
      "verification-docs",
      `driver-${userId}-${documentKey}`,
    );

    // atualizar campo correspondente
    if (isUserField) {
      const updates: any = { verificationStatus: "pending" };
      updates[userFieldMap[documentType]] = url;

      await db.update(users).set(updates).where(eq(users.id, userId));
    } else {
      // Buscar driver
      const [driver] = await db
        .select()
        .from(deliveryDrivers)
        .where(eq(deliveryDrivers.userId, userId))
        .limit(1);

      const updates: any = {};
      updates[driverFieldMap[documentType]] = url;

      if (driver) {
        await db
          .update(deliveryDrivers)
          .set(updates)
          .where(eq(deliveryDrivers.userId, userId));
      } else {
        // Crear nuevo registro
        await db.insert(deliveryDrivers).values({
          id: crypto.randomUUID(),
          userId,
          ...updates,
          isAvailable: false,
          vehicleType: null,
        } as any);
      }

      // Los documentos del vehículo también requieren re-verificación
      await db
        .update(users)
        .set({ verificationStatus: "pending" })
        .where(eq(users.id, userId));
    }

    // Notificar al admin
    try {
      const { notifyAdmins } = await import("../websocket");
      const [user] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      notifyAdmins({
        type: "document_updated",
        userId,
        userName: user?.name || "Usuario",
        documentType,
        message: `Documento actualizado: ${documentType}`,
      });
    } catch {
      /*silencioso*/
    }

    res.json({
      success: true,
      url,
      message: "Documento subido correctamente",
    });
  } catch (error: any) {
    console.error("Error uploading document:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
