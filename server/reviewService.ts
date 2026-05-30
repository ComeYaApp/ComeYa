import { db } from "./db";
import { reviews, businesses, drivers, orders } from "@shared/schema-mysql";
import { eq, and, avg, count, desc } from "drizzle-orm";

export async function createReview(params: any) {
  try {
    const { orderId, userId, businessId, driverId, rating, comment, type } =
      params;

    if (rating < 1 || rating > 5) {
      return {
        success: false,
        error: "La calificación debe ser entre 1 y 5 estrellas",
      };
    }

    const [order] = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.userId, userId),
          eq(orders.status, "delivered"),
        ),
      )
      .limit(1);

    if (!order) {
      return { success: false, error: "Pedido no encontrado o no entregado" };
    }

    const existingReview = await db
      .select()
      .from(reviews)
      .where(
        and(
          eq(reviews.orderId, orderId),
          eq(reviews.userId, userId),
          eq(reviews.type, type),
        ),
      )
      .limit(1);

    if (existingReview.length > 0) {
      return { success: false, error: "Ya has calificado este pedido" };
    }

    const [review] = await db
      .insert(reviews)
      .values({
        orderId,
        userId,
        businessId: type === "business" ? businessId : null,
        rating,
        comment: comment || null,
        approved: true,
        createdAt: new Date(),
      })
      .returning();

    if (type === "business" && businessId) {
      await updateBusinessRating(businessId);
    } else if (type === "driver" && driverId) {
      await updateDriverRating(driverId);
    }

    return {
      success: true,
      review,
    };
  } catch (error: any) {
    console.error("Create review error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function updateBusinessRating(businessId: string) {
  try {
    const [result] = await db
      .select({
        avgRating: avg(reviews.rating),
        totalReviews: count(reviews.id),
      })
      .from(reviews)
      .where(
        and(eq(reviews.businessId, businessId), eq(reviews.approved, true)),
      );

    const avgRating = result.avgRating
      ? Math.round(result.avgRating * 10) / 10
      : 0;
    const totalReviews = result.totalReviews || 0;

    await db
      .update(businesses)
      .set({
        rating: Math.round(avgRating * 10), // Store as 0-50 for 0.0-5.0
        totalRatings: totalReviews,
      })
      .where(eq(businesses.id, businessId));

    console.log(
      `⭐ Updated business ${businessId} rating: ${avgRating} (${totalReviews} reviews)`,
    );
  } catch (error) {
    console.error("Update business rating error:", error);
  }
}

async function updateDriverRating(driverId: string) {
  try {
    const [result] = await db
      .select({
        avgRating: avg(reviews.rating),
        totalReviews: count(reviews.id),
      })
      .from(reviews)
      .where(
        and(
          eq(reviews.driverId, driverId),
          eq(reviews.type, "driver"),
          eq(reviews.isVisible, true),
        ),
      );

    const avgRating = result.avgRating
      ? Math.round(result.avgRating * 10) / 10
      : 0;
    const totalReviews = result.totalReviews || 0;

    await db
      .update(drivers)
      .set({
        rating: avgRating,
        totalReviews,
        updatedAt: new Date(),
      })
      .where(eq(drivers.id, driverId));

    console.log(
      `⭐ Updated driver ${driverId} rating: ${avgRating} (${totalReviews} reviews)`,
    );
  } catch (error) {
    console.error("Update driver rating error:", error);
  }
}

export async function getBusinessReviews(
  businessId: string,
  limit: number = 20,
) {
  try {
    const businessReviews = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        comment: reviews.comment,
        createdAt: reviews.createdAt,
        userName: reviews.userName,
      })
      .from(reviews)
      .where(
        and(
          eq(reviews.businessId, businessId),
          eq(reviews.type, "business"),
          eq(reviews.isVisible, true),
        ),
      )
      .orderBy(desc(reviews.createdAt))
      .limit(limit);

    return {
      success: true,
      reviews: businessReviews,
    };
  } catch (error: any) {
    console.error("Get business reviews error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function getDriverReviews(driverId: string, limit: number = 20) {
  try {
    const driverReviews = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        comment: reviews.comment,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .where(
        and(
          eq(reviews.driverId, driverId),
          eq(reviews.type, "driver"),
          eq(reviews.isVisible, true),
        ),
      )
      .orderBy(desc(reviews.createdAt))
      .limit(limit);

    return {
      success: true,
      reviews: driverReviews,
    };
  } catch (error: any) {
    console.error("Get driver reviews error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function getUserReviews(userId: string) {
  try {
    const userReviews = await db
      .select()
      .from(reviews)
      .where(eq(reviews.userId, userId))
      .orderBy(desc(reviews.createdAt))
      .limit(50);

    return {
      success: true,
      reviews: userReviews,
    };
  } catch (error: any) {
    console.error("Get user reviews error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function hideReview(reviewId: string, adminId: string) {
  try {
    await db
      .update(reviews)
      .set({
        isVisible: false,
        hiddenBy: adminId,
        hiddenAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, reviewId));

    return {
      success: true,
      message: "Reseña ocultada",
    };
  } catch (error: any) {
    console.error("Hide review error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function getReviewStats(businessId?: string, driverId?: string) {
  try {
    let whereCondition;

    if (businessId) {
      whereCondition = and(
        eq(reviews.businessId, businessId),
        eq(reviews.type, "business"),
        eq(reviews.isVisible, true),
      );
    } else if (driverId) {
      whereCondition = and(
        eq(reviews.driverId, driverId),
        eq(reviews.type, "driver"),
        eq(reviews.isVisible, true),
      );
    } else {
      return { success: false, error: "Business ID or Driver ID required" };
    }

    const ratingDistribution = await db
      .select({
        rating: reviews.rating,
        count: count(reviews.id),
      })
      .from(reviews)
      .where(whereCondition)
      .groupBy(reviews.rating)
      .orderBy(reviews.rating);

    const [avgResult] = await db
      .select({
        avgRating: avg(reviews.rating),
        totalReviews: count(reviews.id),
      })
      .from(reviews)
      .where(whereCondition);

    return {
      success: true,
      stats: {
        averageRating: avgResult.avgRating
          ? Math.round(avgResult.avgRating * 10) / 10
          : 0,
        totalReviews: avgResult.totalReviews || 0,
        distribution: ratingDistribution,
      },
    };
  } catch (error: any) {
    console.error("Get review stats error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}
