// Motor de disponibilidad de reservas basado en aforo (comensales) por franja
// horaria, en lugar de un plano de mesas. El negocio configura cuántos
// comensales puede atender a la vez y la duración del turno; ComeYa genera las
// franjas desde su horario de apertura y calcula la carga de cada una.
//
// Si el negocio NO configura aforo (reservation_config = null) se mantiene el
// flujo manual clásico: las franjas se generan con valores por defecto y no
// hay límite de capacidad (remaining = null).
import { db } from "./db";
import { businesses, reservations } from "@shared/schema-mysql";
import { eq, and, inArray } from "drizzle-orm";

export interface ReservationConfig {
  capacityPerSlot: number; // comensales simultáneos por franja
  turnMinutes: number; // duración del turno de mesa
  slotMinutes: number; // intervalo entre franjas ofertadas
  maxPartySize: number; // máximo de comensales por reserva
  advanceDays: number; // antelación máxima en días
  autoConfirm: boolean; // confirmación automática cuando hay aforo
  maxCoversPerDay: number | null; // límite diario total de comensales (opcional)
}

export const DEFAULT_RESERVATION_CONFIG: ReservationConfig = {
  capacityPerSlot: 0,
  turnMinutes: 90,
  slotMinutes: 30,
  maxPartySize: 8,
  advanceDays: 14,
  autoConfirm: false,
  maxCoversPerDay: null,
};

// Tarifa ComeYa por comensal que asiste: 0,99 € en céntimos
export const RESERVATION_FEE_CENTS_PER_GUEST = 99;

// Estados que ocupan aforo (una reserva sentada sigue ocupando hasta cerrarse)
const OCCUPYING_STATUSES = ["pending", "confirmed", "seated"];

type DayEntry = {
  isOpen?: boolean;
  closed?: boolean;
  open?: string;
  openTime?: string;
  close?: string;
  closeTime?: string;
  morning?: { open?: string; close?: string };
  evening?: { open?: string; close?: string };
  hasEvening?: boolean;
  day?: string;
};

function minutesOf(hhmm: string): number | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(hhmm || ""));
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function minutesToHHmm(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function normalizeDayName(value?: string): string {
  return (value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const DAY_NAME_TO_INDEX: Record<string, number> = {
  domingo: 0, sunday: 0,
  lunes: 1, monday: 1,
  martes: 2, tuesday: 2,
  miercoles: 3, miércoles: 3, wednesday: 3,
  jueves: 4, thursday: 4,
  viernes: 5, friday: 5,
  sabado: 6, sábado: 6, saturday: 6,
};

function resolveDayEntry(hours: any, dayOfWeek: number): DayEntry | null {
  if (!hours) return null;
  if (Array.isArray(hours)) {
    const byIndex = hours[dayOfWeek];
    if (byIndex && !isClosed(byIndex)) return byIndex;
    const names = [
      ["domingo", "sunday"], ["lunes", "monday"], ["martes", "tuesday"],
      ["miercoles", "wednesday"], ["jueves", "thursday"], ["viernes", "friday"],
      ["sabado", "saturday"],
    ][dayOfWeek];
    return (
      hours.find((e: DayEntry) =>
        names.some((n) => normalizeDayName(n) === normalizeDayName(e?.day)),
      ) || null
    );
  }
  const byKey = hours[dayOfWeek] || hours[String(dayOfWeek)];
  if (byKey && !isClosed(byKey)) return byKey;
  const names = Object.keys(hours);
  const wanted = [
    ["domingo", "sunday"], ["lunes", "monday"], ["martes", "tuesday"],
    ["miercoles", "wednesday"], ["jueves", "thursday"], ["viernes", "friday"],
    ["sabado", "saturday"],
  ][dayOfWeek];
  const namedKey = names.find((key) =>
    wanted.some((n) => normalizeDayName(n) === normalizeDayName(key)),
  );
  return namedKey ? hours[namedKey] : null;
}

function isClosed(entry: DayEntry): boolean {
  return entry?.closed === true || entry?.isOpen === false;
}

// Ventanas de servicio del día (soporta mañana/tarde y horario nocturno; la
// parte nocturna tras las 00:00 no genera franjas de reserva)
function dayWindows(entry: DayEntry | null): { start: number; end: number }[] {
  if (!entry || isClosed(entry)) return [];
  const windows: { start: number; end: number }[] = [];
  const push = (open?: string, close?: string) => {
    const o = open ? minutesOf(open) : null;
    const c = close ? minutesOf(close) : null;
    if (o === null || c === null || c <= o) return;
    windows.push({ start: o, end: Math.min(c, 24 * 60) });
  };
  if (entry.morning?.open || entry.evening?.open) {
    push(entry.morning?.open, entry.morning?.close);
    push(entry.evening?.open, entry.evening?.close);
  } else {
    push(entry.openTime || entry.open, entry.closeTime || entry.close);
  }
  return windows;
}

// Fecha y hora actuales en la zona del negocio (Europe/Madrid)
export function zonedNow(): { dateStr: string; minutes: number } {
  const timezone = process.env.BUSINESS_TIMEZONE || "Europe/Madrid";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const get = (t: string) =>
      parseInt(parts.find((p) => p.type === t)?.value || "0", 10);
    return {
      dateStr: `${get("year")}-${String(get("month")).padStart(2, "0")}-${String(get("day")).padStart(2, "0")}`,
      minutes: get("hour") % 24 * 60 + get("minute"),
    };
  } catch {
    const now = new Date();
    return {
      dateStr: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
      minutes: now.getHours() * 60 + now.getMinutes(),
    };
  }
}

export class ReservationAvailabilityService {
  // null = sin aforo configurado (flujo manual clásico)
  static parseConfig(raw: unknown): ReservationConfig | null {
    if (!raw) return null;
    let cfg: any;
    if (typeof raw === "string") {
      try {
        cfg = JSON.parse(raw);
      } catch {
        return null;
      }
    } else {
      cfg = raw;
    }
    if (!cfg || typeof cfg !== "object") return null;
    const num = (v: any, min: number, max: number, def: number) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : def;
    };
    const capacity = num(cfg.capacityPerSlot, 0, 500, 0);
    if (capacity <= 0) return null; // aforo 0 = no configurado
    return {
      capacityPerSlot: capacity,
      turnMinutes: num(cfg.turnMinutes, 30, 300, DEFAULT_RESERVATION_CONFIG.turnMinutes),
      slotMinutes: num(cfg.slotMinutes, 15, 120, DEFAULT_RESERVATION_CONFIG.slotMinutes),
      maxPartySize: num(cfg.maxPartySize, 1, 20, DEFAULT_RESERVATION_CONFIG.maxPartySize),
      advanceDays: num(cfg.advanceDays, 1, 60, DEFAULT_RESERVATION_CONFIG.advanceDays),
      autoConfirm: cfg.autoConfirm === true,
      maxCoversPerDay: cfg.maxCoversPerDay
        ? num(cfg.maxCoversPerDay, 1, 1000, 0) || null
        : null,
    };
  }

  static configForBusiness(business: any): ReservationConfig | null {
    return this.parseConfig(business?.reservationConfig);
  }

  // Reservas activas del negocio para una fecha (ocupan aforo)
  static async activeForDay(businessId: string, date: string) {
    return db
      .select({
        time: reservations.time,
        partySize: reservations.partySize,
        status: reservations.status,
      })
      .from(reservations)
      .where(
        and(
          eq(reservations.businessId, businessId),
          eq(reservations.date, date),
          inArray(reservations.status, OCCUPYING_STATUSES),
        ),
      );
  }

  // Franjas del día con su carga. Sin horario configurado se asume turno
  // estándar de comida y cena (como hacía el MVP con RESERVE_TIMES).
  static async getSlotsForDay(
    business: any,
    date: string,
    partySize: number,
  ): Promise<{
    slots: Array<{
      time: string;
      remaining: number | null; // null = sin límite de aforo
      load: number;
      status: "available" | "last" | "full";
      isPast: boolean;
    }>;
    config: ReservationConfig | null;
    windows: { start: string; end: string }[];
  }> {
    const config = this.configForBusiness(business);
    const slotMinutes = config?.slotMinutes ?? DEFAULT_RESERVATION_CONFIG.slotMinutes;
    const turnMinutes = config?.turnMinutes ?? DEFAULT_RESERVATION_CONFIG.turnMinutes;
    const capacity = config?.capacityPerSlot ?? 0;
    const party = Math.max(1, partySize || 2);

    let hours: any = null;
    try {
      hours = business?.openingHours ? JSON.parse(business.openingHours) : null;
    } catch {
      hours = null;
    }
    const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
    const entry = resolveDayEntry(hours, dayOfWeek);
    let windows = dayWindows(entry);
    if (windows.length === 0 && !hours) {
      // Sin horarios: turno estándar 13:00–16:00 y 20:00–23:30
      windows = [
        { start: 13 * 60, end: 16 * 60 },
        { start: 20 * 60, end: 23 * 60 + 30 },
      ];
    }

    const active = await this.activeForDay(business.id, date);
    const now = zonedNow();
    const isToday = now.dateStr === date;

    // Límite diario total de comensales (opcional)
    let dayFull = false;
    if (config?.maxCoversPerDay) {
      const covers = active.reduce(
        (sum: number, r: any) => sum + (r.partySize || 0),
        0,
      );
      dayFull = covers + party > config.maxCoversPerDay;
    }

    const seen = new Set<string>();
    const slots: Array<{
      time: string;
      remaining: number | null;
      load: number;
      status: "available" | "last" | "full";
      isPast: boolean;
    }> = [];

    for (const w of windows) {
      for (let start = w.start; start + turnMinutes <= w.end; start += slotMinutes) {
        const time = minutesToHHmm(start);
        if (seen.has(time)) continue;
        seen.add(time);

        // Carga: reservas cuyo turno [hora, hora+turno) solapa la franja
        let load = 0;
        for (const r of active) {
          const rStart = minutesOf(r.time);
          if (rStart === null) continue;
          if (rStart < start + turnMinutes && rStart + turnMinutes > start) {
            load += r.partySize || 0;
          }
        }

        const isPast = isToday && start <= now.minutes + 29; // margen 30 min
        let remaining: number | null = null;
        let status: "available" | "last" | "full" = "available";
        if (capacity > 0) {
          remaining = Math.max(0, capacity - load);
          if (remaining < party || dayFull) status = "full";
          // "Últimas mesas" solo si la escasez viene de reservas reales:
          // un local vacío nunca se pinta en ámbar aunque el grupo sea grande
          else if (load > 0 && remaining < party * 2) status = "last";
        } else if (dayFull) {
          status = "full";
        }

        slots.push({ time, remaining, load, status, isPast });
      }
    }

    slots.sort((a, b) => a.time.localeCompare(b.time));
    return {
      slots,
      config,
      windows: windows.map((w) => ({
        start: minutesToHHmm(w.start),
        end: minutesToHHmm(w.end),
      })),
    };
  }

  // Resumen del día para la agenda del negocio y el buscador
  static async getDaySummary(business: any, date: string) {
    const config = this.configForBusiness(business);
    const { slots } = await this.getSlotsForDay(business, date, 2);
    const active = await this.activeForDay(business.id, date);
    const confirmedCovers = active
      .filter((r: any) => r.status === "confirmed" || r.status === "seated")
      .reduce((s: number, r: any) => s + (r.partySize || 0), 0);
    const pendingCovers = active
      .filter((r: any) => r.status === "pending")
      .reduce((s: number, r: any) => s + (r.partySize || 0), 0);
    const freeSlots = slots.filter(
      (s: any) => s.status !== "full" && !s.isPast,
    ).length;
    return {
      hasConfig: !!config,
      capacityPerSlot: config?.capacityPerSlot ?? null,
      confirmedCovers,
      pendingCovers,
      totalCovers: confirmedCovers + pendingCovers,
      freeSlots,
      totalSlots: slots.filter((s: any) => !s.isPast).length,
      slots,
    };
  }

  // Re-chequeo en el momento de crear la reserva (protección de carrera)
  static async assertSlotAvailable(
    business: any,
    date: string,
    time: string,
    partySize: number,
  ): Promise<{ ok: boolean; reason?: string }> {
    const config = this.configForBusiness(business);
    if (!config) return { ok: true }; // sin aforo: solo horario

    const start = minutesOf(time);
    if (start === null) return { ok: false, reason: "Hora inválida" };

    const { slots } = await this.getSlotsForDay(business, date, partySize);
    const slot = slots.find((s) => s.time === time);
    if (!slot) {
      return {
        ok: false,
        reason: "Esa hora no está disponible para reservar. Elige otra franja.",
      };
    }
    if (slot.isPast) return { ok: false, reason: "Esa hora ya ha pasado" };
    if (slot.status === "full") {
      return {
        ok: false,
        reason: "Franja completa. Elige otra hora disponible.",
      };
    }
    if (partySize > config.maxPartySize) {
      return {
        ok: false,
        reason: `Este negocio acepta grupos de hasta ${config.maxPartySize} comensales`,
      };
    }
    return { ok: true };
  }

  // ¿Es válida la hora pedida como franja ofrecida? (sin aforo configurado se
  // valida solo contra el horario de apertura, como en el MVP)
  static async isOfferedSlot(
    business: any,
    date: string,
    time: string,
  ): Promise<boolean> {
    const config = this.configForBusiness(business);
    if (!config) return true; // validación por horario en la ruta
    const { slots } = await this.getSlotsForDay(business, date, 2);
    return slots.some((s) => s.time === time);
  }

  // Código corto CY-XXXX único por negocio y día
  static async generateCode(businessId: string, date: string): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = `CY-${Math.floor(1000 + Math.random() * 9000)}`;
      const [existing] = await db
        .select({ id: reservations.id })
        .from(reservations)
        .where(
          and(
            eq(reservations.businessId, businessId),
            eq(reservations.date, date),
            eq(reservations.code, code),
          ),
        )
        .limit(1);
      if (!existing) return code;
    }
    return `CY-${Date.now().toString().slice(-4)}`;
  }

  static async getBusiness(businessId: string) {
    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);
    return business;
  }
}
