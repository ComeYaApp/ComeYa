// Pedidos grupales — alineado al esquema REAL de la BD
// (group_orders: host_user_id, business_id, delivery_address_id, split_method, ...)
// shareToken = id del grupo (la tabla real no tiene columna share_token).
import { db } from "./db";
import {
  groupOrders,
  groupOrderParticipants,
  businesses,
  users,
} from "@shared/schema-mysql";
import { eq, inArray } from "drizzle-orm";

export class GroupOrderService {
  static async createGroupOrder(data: {
    creatorId: string;
    businessId: string;
    businessName?: string;
    deliveryAddress?: string;
    deliveryAddressId?: string | null;
    deliveryLatitude?: string;
    deliveryLongitude?: string;
    expiresInMinutes?: number;
  }) {
    const {
      creatorId,
      businessId,
      deliveryAddressId = null,
      expiresInMinutes = 60,
    } = data;

    const groupOrderId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    await db.insert(groupOrders).values({
      id: groupOrderId,
      hostUserId: creatorId,
      businessId,
      deliveryAddressId,
      splitMethod: "equal",
      status: "open",
      expiresAt,
    });

    return {
      success: true,
      groupOrderId,
      // La tabla real no tiene share_token: usamos el propio id como token
      shareToken: groupOrderId,
      shareLink: `comeya://group-order/${groupOrderId}`,
    };
  }

  static async joinGroupOrder(data: {
    shareToken: string;
    userId: string;
    userName?: string;
    items: any[];
    subtotal: number;
  }) {
    const { shareToken, userId, items, subtotal } = data;

    const [group] = await db
      .select()
      .from(groupOrders)
      .where(eq(groupOrders.id, shareToken))
      .limit(1);
    if (!group) return { success: false, error: "Grupo no encontrado" };
    if (group.status !== "open") {
      return { success: false, error: "El grupo ya no acepta participantes" };
    }
    if (group.expiresAt && group.expiresAt < new Date()) {
      return { success: false, error: "El grupo ha expirado" };
    }

    const [existing] = await db
      .select()
      .from(groupOrderParticipants)
      .where(eq(groupOrderParticipants.userId, userId))
      .limit(1);
    if (existing) {
      return { success: true, participantId: existing.id, alreadyJoined: true };
    }

    const participantId = crypto.randomUUID();
    await db.insert(groupOrderParticipants).values({
      id: participantId,
      groupOrderId: group.id,
      userId,
      items: JSON.stringify(items || []),
      subtotal: subtotal || 0,
      paid: false,
    });

    return { success: true, participantId };
  }

  static async getGroupOrder(groupOrderId: string) {
    const [group] = await db
      .select()
      .from(groupOrders)
      .where(eq(groupOrders.id, groupOrderId))
      .limit(1);
    if (!group) return { success: false, error: "Grupo no encontrado" };

    const [business] = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        image: businesses.image,
      })
      .from(businesses)
      .where(eq(businesses.id, group.businessId))
      .limit(1);

    const participants = await db
      .select()
      .from(groupOrderParticipants)
      .where(eq(groupOrderParticipants.groupOrderId, groupOrderId));

    const userIds = participants.map((p) => p.userId);
    let userNames: Record<string, string> = {};
    if (userIds.length) {
      const userRows = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(inArray(users.id, userIds));
      userNames = Object.fromEntries(
        userRows.map((u) => [u.id, u.name || "Invitado"]),
      );
    }

    return {
      success: true,
      group,
      business: business || null,
      participants: participants.map((p) => ({
        ...p,
        userName: userNames[p.userId] || "Invitado",
      })),
    };
  }

  static async markParticipantPaid(participantId: string, paymentProofUrl?: string) {
    await db
      .update(groupOrderParticipants)
      .set({ paid: true, updatedAt: new Date() })
      .where(eq(groupOrderParticipants.id, participantId));
    return { success: true };
  }

  static async lockGroupOrder(groupOrderId: string, userId: string) {    const [group] = await db
      .select()
      .from(groupOrders)
      .where(eq(groupOrders.id, groupOrderId))
      .limit(1);
    if (!group) return { success: false, error: "Grupo no encontrado" };
    if (group.hostUserId !== userId) {
      return {
        success: false,
        error: "Solo el anfitrión puede bloquear el grupo",
      };
    }

    await db
      .update(groupOrders)
      .set({ status: "locked", updatedAt: new Date() })
      .where(eq(groupOrders.id, groupOrderId));
    return { success: true };
  }

  static async getMyGroups(userId: string) {
    const hosted = await db
      .select()
      .from(groupOrders)
      .where(eq(groupOrders.hostUserId, userId));

    const participations = await db
      .select({ groupOrderId: groupOrderParticipants.groupOrderId })
      .from(groupOrderParticipants)
      .where(eq(groupOrderParticipants.userId, userId));

    const ids = new Set<string>(hosted.map((g) => g.id));
    for (const p of participations) ids.add(p.groupOrderId);
    if (!ids.size) return [];

    const groups = await db
      .select()
      .from(groupOrders)
      .where(inArray(groupOrders.id, [...ids]));
    return groups;
  }
}
