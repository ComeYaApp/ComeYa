import { db } from "./db";
import {
  groupOrders,
  groupOrderParticipants,
  groupOrderInvitations,
  orders,
} from "@shared/schema-mysql";
import { eq, and } from "drizzle-orm";

export class GroupOrderService {
  // Crear pedido grupal
  static async createGroupOrder(data: {
    creatorId: string;
    businessId: string;
    businessName: string;
    deliveryAddress: string;
    deliveryLatitude?: string;
    deliveryLongitude?: string;
    expiresInMinutes?: number;
  }) {
    const {
      creatorId,
      businessId,
      businessName,
      deliveryAddress,
      deliveryLatitude,
      deliveryLongitude,
      expiresInMinutes = 60,
    } = data;

    const groupOrderId = crypto.randomUUID();
    const shareToken = crypto.randomUUID().slice(0, 8);
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    await db.insert(groupOrders).values({
      id: groupOrderId,
      creatorId,
      businessId,
      businessName,
      deliveryAddress,
      deliveryLatitude: deliveryLatitude || null,
      deliveryLongitude: deliveryLongitude || null,
      shareToken,
      expiresAt,
      status: "open",
    });

    return {
      success: true,
      groupOrderId,
      shareToken,
      shareLink: `comeya://group-order/${shareToken}`,
    };
  }

  // Unirse a pedido grupal
  static async joinGroupOrder(data: {
    shareToken: string;
    userId: string;
    userName: string;
    items: any[];
    subtotal: number;
  }) {
    const { shareToken, userId, userName, items, subtotal } = data;

    // Buscar grupo
    const [group] = await db
      .select()
      .from(groupOrders)
      .where(eq(groupOrders.shareToken, shareToken))
      .limit(1);

    if (!group) {
      return { success: false, error: "Grupo no encontrado" };
    }

    if (group.status !== "open") {
      return { success: false, error: "El grupo ya está cerrado" };
    }

    if (new Date() > new Date(group.expiresAt)) {
      return { success: false, error: "El grupo ha expirado" };
    }

    // Verificar si ya está en el grupo
    const [existing] = await db
      .select()
      .from(groupOrderParticipants)
      .where(
        and(
          eq(groupOrderParticipants.groupOrderId, group.id),
          eq(groupOrderParticipants.userId, userId),
        ),
      )
      .limit(1);

    if (existing) {
      return { success: false, error: "Ya estás en este grupo" };
    }

    // Agregar participante
    await db.insert(groupOrderParticipants).values({
      id: crypto.randomUUID(),
      groupOrderId: group.id,
      userId,
      userName,
      items: JSON.stringify(items),
      subtotal,
      paymentStatus: "pending",
    });

    // Actualizar total del grupo
    const participants = await db
      .select()
      .from(groupOrderParticipants)
      .where(eq(groupOrderParticipants.groupOrderId, group.id));

    const totalAmount = participants.reduce((sum, p) => sum + p.subtotal, 0);

    await db
      .update(groupOrders)
      .set({ totalAmount })
      .where(eq(groupOrders.id, group.id));

    return { success: true, groupOrderId: group.id };
  }

  // Obtener detalles del grupo
  static async getGroupOrder(groupOrderId: string) {
    const [group] = await db
      .select()
      .from(groupOrders)
      .where(eq(groupOrders.id, groupOrderId))
      .limit(1);

    if (!group) {
      return { success: false, error: "Grupo no encontrado" };
    }

    const participants = await db
      .select()
      .from(groupOrderParticipants)
      .where(eq(groupOrderParticipants.groupOrderId, groupOrderId));

    return {
      success: true,
      groupOrder: {
        ...group,
        participants: participants.map((p) => ({
          ...p,
          items: JSON.parse(p.items),
        })),
      },
    };
  }

  // Cerrar grupo y crear pedido
  static async lockAndOrder(groupOrderId: string, creatorId: string) {
    const [group] = await db
      .select()
      .from(groupOrders)
      .where(eq(groupOrders.id, groupOrderId))
      .limit(1);

    if (!group) {
      return { success: false, error: "Grupo no encontrado" };
    }

    if (group.creatorId !== creatorId) {
      return { success: false, error: "Solo el creador puede cerrar el grupo" };
    }

    if (group.status !== "open") {
      return { success: false, error: "El grupo ya está cerrado" };
    }

    // Obtener participantes
    const participants = await db
      .select()
      .from(groupOrderParticipants)
      .where(eq(groupOrderParticipants.groupOrderId, groupOrderId));

    if (participants.length === 0) {
      return { success: false, error: "No hay participantes en el grupo" };
    }

    // Combinar todos los items
    const allItems: any[] = [];
    for (const participant of participants) {
      const items = JSON.parse(participant.items);
      allItems.push(...items);
    }

    // Crear pedido principal
    const orderId = crypto.randomUUID();
    const totalAmount = participants.reduce((sum, p) => sum + p.subtotal, 0);
    const deliveryFee = 2500; // Bs.25 fijo

    await db.insert(orders).values({
      id: orderId,
      userId: group.creatorId,
      businessId: group.businessId,
      businessName: group.businessName,
      items: JSON.stringify(allItems),
      status: "pending",
      subtotal: totalAmount,
      deliveryFee,
      total: totalAmount + deliveryFee,
      paymentMethod: "group_split",
      deliveryAddress: group.deliveryAddress,
      deliveryLatitude: group.deliveryLatitude || null,
      deliveryLongitude: group.deliveryLongitude || null,
    });

    // Actualizar grupo
    await db
      .update(groupOrders)
      .set({
        status: "locked",
        orderId,
        lockedAt: new Date(),
        orderedAt: new Date(),
      })
      .where(eq(groupOrders.id, groupOrderId));

    return { success: true, orderId };
  }

  // Marcar pago de participante
  static async markParticipantPaid(
    participantId: string,
    paymentProofUrl?: string,
  ) {
    await db
      .update(groupOrderParticipants)
      .set({
        paymentStatus: "paid",
        paymentProofUrl: paymentProofUrl || null,
        paidAt: new Date(),
      })
      .where(eq(groupOrderParticipants.id, participantId));

    return { success: true };
  }

  // Obtener grupos del usuario
  static async getUserGroupOrders(userId: string) {
    // Grupos creados
    const createdGroups = await db
      .select()
      .from(groupOrders)
      .where(eq(groupOrders.creatorId, userId));

    // Grupos donde participa
    const participations = await db
      .select()
      .from(groupOrderParticipants)
      .where(eq(groupOrderParticipants.userId, userId));

    const participantGroupIds = participations.map((p) => p.groupOrderId);
    const participantGroups =
      participantGroupIds.length > 0
        ? await db
            .select()
            .from(groupOrders)
            .where(eq(groupOrders.id, participantGroupIds[0])) // Simplificado
        : [];

    return {
      success: true,
      createdGroups,
      participantGroups,
    };
  }
}
