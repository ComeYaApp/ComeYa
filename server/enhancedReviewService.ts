import { db } from "./db";
import {
  reviews,
  reviewTags,
  reviewResponses,
  businesses,
  deliveryDrivers,
} from "@shared/schema-mysql";
import { eq, and, desc } from "drizzle-orm";
import { CloudinaryService } from "./cloudinaryService";

export class EnhancedReviewService {
  // Crear review mejorada
  static async createReview(data: {
    userId: string;
    orderId: string;
    businessId: string;
    deliveryPersonId?: string;
    foodRating?: number;
    deliveryRating?: number;
    packagingRating?: number;
    driverRating?: number;
    comment?: string;
    tags?: string[];
    photos?: string[];
    tipAmount?: number;
  }) {
    const {
      userId,
      orderId,
      businessId,
      deliveryPersonId,
      foodRating,
      deliveryRating,
      packagingRating,
      driverRating,
      comment,
      tags,
      photos,
      tipAmount,
    } = data;

    // Subir fotos a Cloudinary
    let photoUrls: string[] = [];
    if (photos && photos.length > 0) {
      photoUrls = await Promise.all(
        photos.map(async (photo, index) => {
          if (photo.startsWith("data:image/")) {
            return await CloudinaryService.uploadImage(
              photo,
              "reviews",
              `review-${orderId}-${index}`,
            );
          }
          return photo;
        }),
      );
    }

    // Calcular rating general (promedio)
    const ratings = [foodRating, deliveryRating, packagingRating].filter(
      (r) => r && r > 0,
    );
    const averageRating =
      ratings.length > 0
        ? Math.round(ratings.reduce((a, b) => a! + b!, 0)! / ratings.length)
        : 5;

    const reviewId = crypto.randomUUID();

    await db.insert(reviews).values({
      id: reviewId,
      userId,
      orderId,
      businessId,
      deliveryPersonId: deliveryPersonId || null,
      rating: averageRating,
      foodRating: foodRating || null,
      deliveryRating: deliveryRating || null,
      packagingRating: packagingRating || null,
      deliveryPersonRating: driverRating || null,
      comment: comment || null,
      photos: photoUrls.length > 0 ? JSON.stringify(photoUrls) : null,
      tags: tags && tags.length > 0 ? JSON.stringify(tags) : null,
      approved: true,
      flagged: false,
      tipAmount: tipAmount || 0,
    });

    // Actualizar rating del negocio
    await this.updateBusinessRating(businessId);

    // Actualizar rating del repartidor si aplica
    if (deliveryPersonId && driverRating) {
      await this.updateDriverRating(deliveryPersonId);
    }

    // Verificar achievements de resenas
    try {
      const { GamificationService } = await import("./gamificationService");
      const { count: countFn } = await import("drizzle-orm");
      const { achievements: achTable } = await import("@shared/schema-mysql");
      const [{ value: reviewCount }] = await db
        .select({ value: countFn() })
        .from(reviews)
        .where(eq(reviews.userId, userId));
      const reviewAchievements = await db
        .select()
        .from(achTable)
        .where(eq(achTable.requirementType, "review_count"));
      for (const ach of reviewAchievements) {
        if (Number(reviewCount) >= ach.requirementValue) {
          await (GamificationService as any).unlockAchievement(userId, ach.id);
        }
      }
    } catch {}

    return { success: true, reviewId };
  }

  // Actualizar rating promedio del negocio
  private static async updateBusinessRating(businessId: string) {
    const businessReviews = await db
      .select()
      .from(reviews)
      .where(
        and(eq(reviews.businessId, businessId), eq(reviews.approved, true)),
      );

    if (businessReviews.length === 0) return;

    const totalRating = businessReviews.reduce((sum, r) => sum + r.rating, 0);
    const avgRating = Math.round((totalRating / businessReviews.length) * 10); // 0-50 scale

    await db
      .update(businesses)
      .set({
        rating: avgRating,
        totalRatings: businessReviews.length,
      })
      .where(eq(businesses.id, businessId));
  }

  // Actualizar rating promedio del repartidor
  private static async updateDriverRating(driverId: string) {
    const driverReviews = await db
      .select()
      .from(reviews)
      .where(
        and(eq(reviews.deliveryPersonId, driverId), eq(reviews.approved, true)),
      );

    if (driverReviews.length === 0) return;

    const ratingsWithDriver = driverReviews.filter(
      (r) => r.deliveryPersonRating,
    );
    if (ratingsWithDriver.length === 0) return;

    const totalRating = ratingsWithDriver.reduce(
      (sum, r) => sum + (r.deliveryPersonRating || 0),
      0,
    );
    const avgRating = Math.round((totalRating / ratingsWithDriver.length) * 10); // 0-50 scale

    await db
      .update(deliveryDrivers)
      .set({
        rating: avgRating,
        totalRatings: ratingsWithDriver.length,
      })
      .where(eq(deliveryDrivers.userId, driverId));
  }

  // Obtener tags disponibles
  static async getTags() {
    const tags = await db
      .select()
      .from(reviewTags)
      .where(eq(reviewTags.isActive, true))
      .orderBy(reviewTags.displayOrder);

    return { success: true, tags };
  }

  // Obtener reviews de un negocio
  static async getBusinessReviews(businessId: string, limit = 20) {
    const businessReviews = await db
      .select()
      .from(reviews)
      .where(
        and(eq(reviews.businessId, businessId), eq(reviews.approved, true)),
      )
      .orderBy(desc(reviews.createdAt))
      .limit(limit);

    // Cargar respuestas de negocios
    const reviewsWithResponses = await Promise.all(
      businessReviews.map(async (review) => {
        const [response] = await db
          .select()
          .from(reviewResponses)
          .where(eq(reviewResponses.reviewId, review.id))
          .limit(1);

        return {
          ...review,
          photos: review.photos ? JSON.parse(review.photos) : [],
          tags: review.tags ? JSON.parse(review.tags) : [],
          response: response || null,
        };
      }),
    );

    return { success: true, reviews: reviewsWithResponses };
  }

  // Responder a una review (solo dueño del negocio)
  static async respondToReview(
    reviewId: string,
    businessId: string,
    respondedBy: string,
    responseText: string,
  ) {
    // Verificar que la review pertenece al negocio
    const [review] = await db
      .select()
      .from(reviews)
      .where(and(eq(reviews.id, reviewId), eq(reviews.businessId, businessId)))
      .limit(1);

    if (!review) {
      return { success: false, error: "Review no encontrada" };
    }

    // Verificar si ya existe una respuesta
    const [existing] = await db
      .select()
      .from(reviewResponses)
      .where(eq(reviewResponses.reviewId, reviewId))
      .limit(1);

    if (existing) {
      // Actualizar respuesta existente
      await db
        .update(reviewResponses)
        .set({ responseText, updatedAt: new Date() })
        .where(eq(reviewResponses.id, existing.id));
    } else {
      // Crear nueva respuesta
      await db.insert(reviewResponses).values({
        id: crypto.randomUUID(),
        reviewId,
        businessId,
        responseText,
        respondedBy,
      });
    }

    return { success: true };
  }
}
