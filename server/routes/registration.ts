import express from "express";
import { CloudinaryService } from "../cloudinaryService";
import { db } from "../db";
import { users, deliveryDrivers } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";

const router = express.Router();

// POST /api/registration/upload-documents
router.post("/upload-documents", async (req, res) => {
  try {
    const {
      userId,
      idDocument,
      idDocumentBack,
      autonomoDocument,
      profilePhoto,
      vehiclePhoto,
      vehicleDocument,
      insuranceDocument,
      vehicleType,
      vehiclePlate,
      vehicleBrand,
      vehicleModel,
      vehicleColor,
    } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId requerido" });
    }

    const uploadedUrls: Record<string, string> = {};

    // Subir DNI/NIE (obligatorio para todos)
    if (idDocument) {
      uploadedUrls.idDocument = await CloudinaryService.uploadDocument(
        idDocument,
        "verification-docs",
        `id-front-${userId}`,
      );
    }

    // Subir reverso del DNI/NIE (opcional)
    if (idDocumentBack) {
      uploadedUrls.idDocumentBack = await CloudinaryService.uploadDocument(
        idDocumentBack,
        "verification-docs",
        `id-back-${userId}`,
      );
    }

    // Subir documento de autónomo (obligatorio para business_owner y delivery_driver)
    if (autonomoDocument) {
      uploadedUrls.autonomoDocument = await CloudinaryService.uploadDocument(
        autonomoDocument,
        "verification-docs",
        `autonomo-${userId}`,
      );
    }

    // Subir foto de perfil (obligatorio para delivery_driver)
    if (profilePhoto) {
      uploadedUrls.profilePhoto = await CloudinaryService.uploadImage(
        profilePhoto,
        "profiles",
        `profile-${userId}`,
      );

      // Actualizar profileImage en users
      await db
        .update(users)
        .set({ profileImage: uploadedUrls.profilePhoto } as any)
        .where(eq(users.id, userId));
    }

    // Subir foto del vehículo (obligatorio para delivery_driver)
    if (vehiclePhoto) {
      uploadedUrls.vehiclePhoto = await CloudinaryService.uploadImage(
        vehiclePhoto,
        "profiles",
        `vehicle-${userId}`,
      );
    }

    // Subir permiso de circulación (obligatorio para motos/coches)
    if (vehicleDocument) {
      uploadedUrls.vehicleDocument = await CloudinaryService.uploadDocument(
        vehicleDocument,
        "verification-docs",
        `vehicle-doc-${userId}`,
      );
    }

    // Subir seguro (obligatorio para motos/coches)
    if (insuranceDocument) {
      uploadedUrls.insuranceDocument = await CloudinaryService.uploadDocument(
        insuranceDocument,
        "verification-docs",
        `insurance-${userId}`,
      );
    }

    // Si es repartidor, crear/actualizar registro en delivery_drivers
    if (vehicleType) {
      const [existingDriver] = await db
        .select()
        .from(deliveryDrivers)
        .where(eq(deliveryDrivers.userId, userId))
        .limit(1);

      const driverData = {
        vehicleType,
        vehiclePlate: vehiclePlate || null,
        vehicleBrand: vehicleBrand || null,
        vehicleModel: vehicleModel || null,
        vehicleColor: vehicleColor || null,
        vehiclePhoto: uploadedUrls.vehiclePhoto || null,
        status: "pending_verification" as const,
      };

      if (existingDriver) {
        await db
          .update(deliveryDrivers)
          .set(driverData as any)
          .where(eq(deliveryDrivers.userId, userId));
      } else {
        await db.insert(deliveryDrivers).values({
          id: crypto.randomUUID(),
          userId,
          ...driverData,
          isAvailable: false,
          currentLat: null,
          currentLng: null,
        } as any);
      }
    }

    res.json({
      success: true,
      uploadedUrls,
      message: "Documentos subidos correctamente",
    });
  } catch (error: any) {
    console.error("Error uploading documents:", error);
    res
      .status(500)
      .json({ error: error.message || "Error al subir documentos" });
  }
});

export default router;
