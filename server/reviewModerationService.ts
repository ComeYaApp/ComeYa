import { db } from "./db";
import { reviews, businesses, users } from "../shared/schema-mysql";
import { eq, and, desc, sql } from "drizzle-orm";

interface ReviewModerationResult {
  approved: boolean;
  reason?: string;
  flagged: boolean;
}

const SPAM_KEYWORDS = [
  "spam",
  "fake",
  "bot",
  "scam",
  "fraude",
  "http://",
  "https://",
  "www.",
  ".com",
  ".mx",
  "whatsapp",
  "telegram",
  "contacto",
];

const OFFENSIVE_KEYWORDS = [
  // Agregar palabras ofensivas según contexto local
  "idiota",
  "estúpido",
  "basura",
  "porquería",
];

export function moderateReview(
  rating: number,
  comment: string,
): ReviewModerationResult {
  const lowerComment = comment.toLowerCase();

  // Detectar spam
  const hasSpamKeywords = SPAM_KEYWORDS.some((keyword) =>
    lowerComment.includes(keyword),
  );

  if (hasSpamKeywords) {
    return {
      approved: false,
      reason: "Contenido detectado como spam",
      flagged: true,
    };
  }

  // Detectar lenguaje ofensivo
  const hasOffensiveContent = OFFENSIVE_KEYWORDS.some((keyword) =>
    lowerComment.includes(keyword),
  );

  if (hasOffensiveContent) {
    return {
      approved: false,
      reason: "Contenido ofensivo detectado",
      flagged: true,
    };
  }

  // Detectar reseñas muy cortas sin sentido
  if (comment.length < 10 && comment.length > 0) {
    return {
      approved: false,
      reason: "Reseña demasiado corta",
      flagged: true,
    };
  }

  // Detectar reseñas con solo mayúsculas (gritos)
  const upperCaseRatio =
    (comment.match(/[A-Z]/g) || []).length / comment.length;
  if (upperCaseRatio > 0.7 && comment.length > 20) {
    return {
      approved: false,
      reason: "Uso excesivo de mayúsculas",
      flagged: true,
    };
  }

  // Detectar rating inconsistente con comentario
  const positiveWords = [
    "excelente",
    "bueno",
    "rico",
    "delicioso",
    "rápido",
    "genial",
  ];
  const negativeWords = [
    "malo",
    "pésimo",
    "horrible",
    "tardado",
    "frío",
    "sucio",
  ];

  const hasPositive = positiveWords.some((word) => lowerComment.includes(word));
  const hasNegative = negativeWords.some((word) => lowerComment.includes(word));

  if (rating >= 4 && hasNegative && !hasPositive) {
    return {
      approved: true, // Aprobar pero marcar para revisión
      flagged: true,
      reason: "Rating inconsistente con comentario",
    };
  }

  if (rating <= 2 && hasPositive && !hasNegative) {
    return {
      approved: true,
      flagged: true,
      reason: "Rating inconsistente con comentario",
    };
  }

  return {
    approved: true,
    flagged: false,
  };
}

export async function submitReview(
  userId: number,
  orderId: number,
  businessId: number,
  rating: number,
  comment: string,
): Promise<{ reviewId: number; moderation: ReviewModerationResult }> {
  // Moderar la reseña
  const moderation = moderateReview(rating, comment);

  const [review] = await db
    .insert(reviews)
    .values({
      userId,
      orderId,
      businessId,
      rating,
      comment,
      approved: moderation.approved,
      flagged: moderation.flagged,
      moderationReason: moderation.reason,
      createdAt: new Date(),
    })
    .returning();

  // Actualizar rating promedio del negocio
  if (moderation.approved) {
    await updateBusinessRating(businessId);
  }

  return {
    reviewId: review.id,
    moderation,
  };
}

export async function updateBusinessRating(businessId: number): Promise<void> {
  const result = await db
    .select({
      avgRating: sql<number>`AVG(${reviews.rating})`,
      totalReviews: sql<number>`COUNT(*)`,
    })
    .from(reviews)
    .where(and(eq(reviews.businessId, businessId), eq(reviews.approved, true)));

  const { avgRating, totalReviews } = result[0];

  await db
    .update(businesses)
    .set({
      rating: avgRating ? Math.round(avgRating * 10) / 10 : 0,
      totalReviews: totalReviews || 0,
    })
    .where(eq(businesses.id, businessId));
}

export async function approveReview(reviewId: number): Promise<void> {
  const [review] = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1);

  if (!review) {
    throw new Error("Reseña no encontrada");
  }

  await db
    .update(reviews)
    .set({
      approved: true,
      flagged: false,
    })
    .where(eq(reviews.id, reviewId));

  await updateBusinessRating(review.businessId);
}

export async function rejectReview(
  reviewId: number,
  reason: string,
): Promise<void> {
  await db
    .update(reviews)
    .set({
      approved: false,
      moderationReason: reason,
    })
    .where(eq(reviews.id, reviewId));
}

export async function addBusinessResponse(
  reviewId: number,
  businessId: number,
  response: string,
): Promise<void> {
  const [review] = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.id, reviewId), eq(reviews.businessId, businessId)))
    .limit(1);

  if (!review) {
    throw new Error("Reseña no encontrada o no pertenece a este negocio");
  }

  await db
    .update(reviews)
    .set({
      businessResponse: response,
      businessResponseAt: new Date(),
    })
    .where(eq(reviews.id, reviewId));
}

export async function getFlaggedReviews() {
  return db
    .select({
      review: reviews,
      user: users,
      business: businesses,
    })
    .from(reviews)
    .leftJoin(users, eq(reviews.userId, users.id))
    .leftJoin(businesses, eq(reviews.businessId, businesses.id))
    .where(eq(reviews.flagged, true))
    .orderBy(desc(reviews.createdAt));
}

export async function getBusinessReviews(
  businessId: number,
  includeUnapproved: boolean = false,
) {
  const conditions = includeUnapproved
    ? eq(reviews.businessId, businessId)
    : and(eq(reviews.businessId, businessId), eq(reviews.approved, true));

  return db
    .select({
      review: reviews,
      user: users,
    })
    .from(reviews)
    .leftJoin(users, eq(reviews.userId, users.id))
    .where(conditions)
    .orderBy(desc(reviews.createdAt));
}

export async function detectReviewAbuse(userId: number): Promise<boolean> {
  const recentReviews = await db
    .select()
    .from(reviews)
    .where(eq(reviews.userId, userId))
    .orderBy(desc(reviews.createdAt))
    .limit(10);

  // Detectar si el usuario ha dejado muchas reseñas en poco tiempo
  if (recentReviews.length >= 5) {
    const firstReview = recentReviews[recentReviews.length - 1];
    const timeDiff = Date.now() - new Date(firstReview.createdAt).getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    // Más de 5 reseñas en menos de 1 hora = posible abuso
    if (hoursDiff < 1) {
      return true;
    }
  }

  // Detectar si todas las reseñas son muy similares (spam)
  if (recentReviews.length >= 3) {
    const comments = recentReviews.map((r) => r.comment.toLowerCase());
    const uniqueComments = new Set(comments);

    // Si más del 70% son idénticas
    if (uniqueComments.size / comments.length < 0.3) {
      return true;
    }
  }

  return false;
}
