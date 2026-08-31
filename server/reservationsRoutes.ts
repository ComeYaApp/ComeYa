// Reservas de mesa (MVP): los negocios sin reparto pueden estar en la
// plataforma, mostrar sus productos y recibir reservas que gestionan desde
// su panel. El cliente reserva desde la ficha del negocio y ve las suyas.
import { Router } from "express";
import { db } from "./db";
import { reservations, businesses, users } from "@shared/schema-mysql";
import { eq, and, desc, inArray } from "drizzle-orm";
import { authenticateToken, requireRole } from "./authMiddleware";
import {
  asyncHandler,
  ValidationError,
  NotFoundError,
  AuthorizationError,
} from "./errors";
import { sendPushToUser } from "./enhancedPushService";
import { BusinessHoursService } from "./businessHoursService";
import { randomUUID } from "crypto";

const router = Router();

function todayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

// Crear reserva (cliente)
router.post(
  "/",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const {
      businessId,
      date,
      time,
      partySize,
      customerName,
      customerPhone,
      notes,
    } = req.body || {};

    if (!businessId || !date || !time) {
      throw new ValidationError("Negocio, fecha y hora son obligatorios");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      throw new ValidationError("Fecha inválida (formato YYYY-MM-DD)");
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(time))) {
      throw new ValidationError("Hora inválida (formato HH:mm)");
    }
    const size = Math.max(1, Math.min(20, Number(partySize) || 2));

    if (new Date(`${date}T00:00:00`) < new Date(`${todayStr()}T00:00:00`)) {
      throw new ValidationError("No se puede reservar en una fecha pasada");
    }
    if (
      new Date(`${date}T00:00:00`) >
      new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
    ) {
      throw new ValidationError(
        "Solo se puede reservar con hasta 60 días de antelación",
      );
    }

    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);
    if (!business) throw new NotFoundError("Negocio no encontrado");
    if (!business.reservationsEnabled) {
      throw new ValidationError("Este negocio no acepta reservas por la app");
    }

    // La hora pedida debe caer dentro del horario del negocio ese día
    const openAt = await BusinessHoursService.isOpenAt(businessId, date, time);
    if (!openAt) {
      throw new ValidationError(
        "El negocio está cerrado a esa hora. Elige otro horario.",
      );
    }

    // Sin duplicados: una reserva activa por cliente, negocio y día
    const [dup] = await db
      .select({ id: reservations.id })
      .from(reservations)
      .where(
        and(
          eq(reservations.userId, userId),
          eq(reservations.businessId, businessId),
          eq(reservations.date, date),
          inArray(reservations.status, ["pending", "confirmed"]),
        ),
      )
      .limit(1);
    if (dup) {
      throw new ValidationError(
        "Ya tienes una reserva para ese día en este negocio",
      );
    }

    const [user] = await db
      .select({ name: users.name, phone: users.phone })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const id = randomUUID();
    const finalName = String(customerName || user?.name || "").slice(0, 255);
    const finalPhone = String(customerPhone || user?.phone || "").slice(0, 50);
    await db.insert(reservations).values({
      id,
      businessId,
      userId,
      date,
      time,
      partySize: size,
      customerName: finalName,
      customerPhone: finalPhone,
      notes: notes ? String(notes).slice(0, 500) : null,
      status: "pending",
    });

    const row = {
      id,
      businessId,
      userId,
      date,
      time,
      partySize: size,
      customerName: finalName,
      customerPhone: finalPhone,
      status: "pending",
    };

    if (business.ownerId) {
      await sendPushToUser(business.ownerId, {
        title: "📅 Nueva reserva",
        body: `${finalName || "Cliente"} reservó para ${size} el ${date} a las ${time}`,
        data: { reservationId: id, screen: "BusinessReservations" },
      });
    }
    try {
      const { notifyNewReservation } = await import("./websocket");
      notifyNewReservation(businessId, row);
    } catch {}

    res.json({ success: true, reservation: row });
  }),
);

// Mis reservas (cliente)
router.get(
  "/mine",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const rows = await db
      .select({
        reservation: reservations,
        businessName: businesses.name,
        businessImage: businesses.image,
        businessAddress: businesses.address,
        businessPhone: businesses.phone,
      })
      .from(reservations)
      .leftJoin(businesses, eq(businesses.id, reservations.businessId))
      .where(eq(reservations.userId, userId))
      .orderBy(desc(reservations.date), desc(reservations.time))
      .limit(100);
    res.json({
      success: true,
      reservations: rows.map((r: any) => ({
        ...r.reservation,
        businessName: r.businessName,
        businessImage: r.businessImage,
        businessAddress: r.businessAddress,
        businessPhone: r.businessPhone,
      })),
    });
  }),
);

// Cancelar reserva (cliente) — solo pendiente/confirmada
router.post(
  "/:id/cancel",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const [r] = await db
      .select()
      .from(reservations)
      .where(eq(reservations.id, req.params.id as string))
      .limit(1);
    if (!r) throw new NotFoundError("Reserva no encontrada");
    if (
      r.userId !== (req as any).user.id &&
      !["admin", "super_admin"].includes((req as any).user.role)
    ) {
      throw new AuthorizationError("No autorizado");
    }
    if (r.status !== "pending" && r.status !== "confirmed") {
      throw new ValidationError("La reserva ya no se puede cancelar");
    }
    await db
      .update(reservations)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(reservations.id, r.id));

    const [biz] = await db
      .select({ ownerId: businesses.ownerId })
      .from(businesses)
      .where(eq(businesses.id, r.businessId))
      .limit(1);
    if (biz?.ownerId) {
      await sendPushToUser(biz.ownerId, {
        title: "❌ Reserva cancelada",
        body: `${r.customerName || "Cliente"} canceló la reserva del ${r.date} a las ${r.time} (${r.partySize} personas)`,
        data: { reservationId: r.id, screen: "BusinessReservations" },
      });
    }
    try {
      const { notifyNewReservation } = await import("./websocket");
      notifyNewReservation(r.businessId, { id: r.id, status: "cancelled" });
    } catch {}

    res.json({ success: true, message: "Reserva cancelada" });
  }),
);

// Reservas del negocio (panel): el dueño ve las de SUS negocios, el admin
// todas. Filtro opcional ?date=YYYY-MM-DD; por defecto hoy y futuras.
router.get(
  "/business",
  authenticateToken,
  requireRole("business_owner", "admin", "super_admin"),
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const role = (req as any).user.role;
    const dateFilter = String(req.query.date || "");

    const myBusinesses =
      role === "admin" || role === "super_admin"
        ? await db
            .select({ id: businesses.id })
            .from(businesses)
            .limit(500)
        : await db
            .select({ id: businesses.id })
            .from(businesses)
            .where(eq(businesses.ownerId, userId));
    const businessIds = myBusinesses.map((b: any) => b.id);
    if (businessIds.length === 0) {
      return res.json({ success: true, reservations: [] });
    }

    const rows = await db
      .select({
        reservation: reservations,
        businessName: businesses.name,
      })
      .from(reservations)
      .leftJoin(businesses, eq(businesses.id, reservations.businessId))
      .where(
        dateFilter
          ? and(
              inArray(reservations.businessId, businessIds),
              eq(reservations.date, dateFilter),
            )
          : and(
              inArray(reservations.businessId, businessIds),
              inArray(reservations.status, ["pending", "confirmed"]),
            ),
      )
      .orderBy(desc(reservations.date), desc(reservations.time))
      .limit(200);

    res.json({
      success: true,
      reservations: rows.map((r: any) => ({
        ...r.reservation,
        businessName: r.businessName,
      })),
    });
  }),
);

// Confirmar o rechazar una reserva (negocio dueño / admin)
router.put(
  "/business/:id/status",
  authenticateToken,
  requireRole("business_owner", "admin", "super_admin"),
  asyncHandler(async (req, res) => {
    const { status, businessNote } = req.body || {};
    if (!["confirmed", "rejected"].includes(status)) {
      throw new ValidationError("Estado inválido (confirmed | rejected)");
    }

    const [r] = await db
      .select()
      .from(reservations)
      .where(eq(reservations.id, req.params.id as string))
      .limit(1);
    if (!r) throw new NotFoundError("Reserva no encontrada");

    const role = (req as any).user.role;
    const [biz] = await db
      .select({ ownerId: businesses.ownerId, name: businesses.name })
      .from(businesses)
      .where(eq(businesses.id, r.businessId))
      .limit(1);
    if (
      role !== "admin" &&
      role !== "super_admin" &&
      biz?.ownerId !== (req as any).user.id
    ) {
      throw new AuthorizationError("No autorizado");
    }
    if (r.status !== "pending") {
      throw new ValidationError("La reserva ya fue gestionada");
    }

    await db
      .update(reservations)
      .set({
        status,
        businessNote: businessNote ? String(businessNote).slice(0, 500) : null,
        updatedAt: new Date(),
      })
      .where(eq(reservations.id, r.id));

    const updated = {
      ...r,
      status,
      businessNote: businessNote ? String(businessNote).slice(0, 500) : null,
    };

    await sendPushToUser(r.userId, {
      title: status === "confirmed" ? "✅ Reserva confirmada" : "❌ Reserva rechazada",
      body:
        status === "confirmed"
          ? `${biz?.name || "El negocio"} confirmó tu reserva del ${r.date} a las ${r.time} (${r.partySize} personas)`
          : `${biz?.name || "El negocio"} no pudo aceptar tu reserva del ${r.date} a las ${r.time}.`,
      data: { reservationId: r.id, screen: "MyReservations" },
    });
    try {
      const { notifyReservationStatusChange } = await import("./websocket");
      notifyReservationStatusChange(r.userId, updated);
    } catch {}

    res.json({ success: true, reservation: updated });
  }),
);

export default router;
