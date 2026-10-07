import { db } from "./db";
import { businesses } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";

type DaySchedule = {
  isOpen?: boolean;
  closed?: boolean;
  openTime?: string;
  open?: string;
  closeTime?: string;
  close?: string;
  day?: string;
  eveningOpen?: string;
  eveningClose?: string;
};

function getZonedNow(): Date {
  // ComeYa opera en Soria, España: hora de Madrid por defecto
  const timezone = process.env.BUSINESS_TIMEZONE || "Europe/Madrid";
  try {
    // Get the time components as numbers in the target timezone
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(new Date());

    const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || "0", 10);
    const year = get("year");
    const month = get("month") - 1; // JS months are 0-based
    const day = get("day");
    const hour = get("hour");
    const minute = get("minute");
    const second = get("second");

    return new Date(year, month, day, hour, minute, second);
  } catch {
    // Fallback: usar hora local del servidor
    return new Date();
  }
}

function normalizeDayName(value?: string): string {
  return (value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Mapa de nombres de días en español e inglés al índice (0=domingo, 1=lunes...)
const DAY_NAME_TO_INDEX: Record<string, number> = {
  domingo: 0, sunday: 0,
  lunes: 1, monday: 1,
  martes: 2, tuesday: 2,
  miercoles: 3, miércoles: 3, wednesday: 3,
  jueves: 4, thursday: 4,
  viernes: 5, friday: 5,
  sabado: 6, sábado: 6, saturday: 6,
};

// ¿Tiene el día alguna ventana de servicio definida? (mañana o tarde)
function hasAnyWindow(entry: DaySchedule | undefined | null): boolean {
  if (!entry) return false;
  const hasMain = !!(
    (entry.openTime || entry.open) && (entry.closeTime || entry.close)
  );
  const hasEvening = !!(entry.eveningOpen && entry.eveningClose);
  return hasMain || hasEvening;
}

function resolveTodaySchedule(
  hours: any,
  dayOfWeek: number,
): DaySchedule | null {
  if (!hours) return null;

  // ─── CASO 1: Array ────────────────────────────────────────────────────
  if (Array.isArray(hours)) {
    const byIndex = hours[dayOfWeek];
    if (byIndex && !isDayClosed(byIndex) && hasAnyWindow(byIndex)) {
      return byIndex;
    }
    // Buscar por nombre de día (español o inglés)
    const todayNames = [
      ["domingo", "sunday"], ["lunes", "monday"], ["martes", "tuesday"],
      ["miercoles", "wednesday"], ["jueves", "thursday"], ["viernes", "friday"],
      ["sabado", "saturday"],
    ][dayOfWeek];

    const byName = hours.find((entry: DaySchedule) => {
      const normalized = normalizeDayName(entry?.day);
      return todayNames.some((n) => normalizeDayName(n) === normalized);
    });
    return byName || null;
  }

  // ─── CASO 2: Objeto indexado numéricamente ─────────────────────────────
  const byKey = hours[dayOfWeek] || hours[String(dayOfWeek)];
  if (byKey && !isDayClosed(byKey) && hasAnyWindow(byKey)) {
    return byKey;
  }

  // ─── CASO 3: Objeto con claves en español o inglés ─────────────────────
  const todayNames = [
    ["domingo", "sunday"], ["lunes", "monday"], ["martes", "tuesday"],
    ["miercoles", "wednesday"], ["jueves", "thursday"], ["viernes", "friday"],
    ["sabado", "saturday"],
  ][dayOfWeek];

  const dayNameKeys = Object.keys(hours);
  const namedKey = dayNameKeys.find((key) =>
    todayNames.some((n) => normalizeDayName(key) === normalizeDayName(n)),
  );

  return namedKey ? hours[namedKey] : null;
}

function isDayClosed(schedule: DaySchedule): boolean {
  if (schedule.closed === true) return true;
  if (schedule.isOpen === false) return true;
  return false;
}

function parseTimeToMinutes(timeValue?: string): number | null {
  if (!timeValue || typeof timeValue !== "string") return null;
  const [hoursRaw, minutesRaw] = timeValue.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

// ¿Cae reqMin dentro de la ventana? Soporta tramos nocturnos (cierre < apertura).
// null = ventana inválida o sin definir.
function inWindow(
  openMin: number | null,
  closeMin: number | null,
  reqMin: number,
): boolean | null {
  if (openMin === null || closeMin === null) return null;
  if (closeMin < openMin) return reqMin >= openMin || reqMin <= closeMin;
  return reqMin >= openMin && reqMin <= closeMin;
}

export class BusinessHoursService {
  // ¿Está abierto el negocio en una fecha/hora concreta? (para reservas).
  // dateStr: YYYY-MM-DD, timeStr: HH:mm. Sin horario configurado → abierto.
  static async isOpenAt(
    businessId: string,
    dateStr: string,
    timeStr: string,
  ): Promise<boolean> {
    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    if (!business || !business.openingHours) return true;

    try {
      const hours = JSON.parse(business.openingHours);
      const dayOfWeek = new Date(`${dateStr}T12:00:00`).getDay();
      const schedule = resolveTodaySchedule(hours, dayOfWeek);
      if (!schedule || isDayClosed(schedule)) return false;

      const reqMin = parseTimeToMinutes(timeStr);
      if (reqMin === null) return true;

      const morningOk = inWindow(
        parseTimeToMinutes(schedule.openTime || schedule.open),
        parseTimeToMinutes(schedule.closeTime || schedule.close),
        reqMin,
      );
      const eveningOk = inWindow(
        parseTimeToMinutes(schedule.eveningOpen),
        parseTimeToMinutes(schedule.eveningClose),
        reqMin,
      );
      // Sin horarios válidos en el día → abierto (comportamiento clásico)
      if (morningOk === null && eveningOk === null) return true;
      return morningOk === true || eveningOk === true;
    } catch {
      return true;
    }
  }

  // Check if business should be open based on current time
  static async isBusinessOpen(businessId: string): Promise<boolean> {    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    if (!business || !business.openingHours) return true;

    try {
      const hours = JSON.parse(business.openingHours);
      const now = getZonedNow();
      const dayOfWeek = now.getDay();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTimeInMinutes = currentHour * 60 + currentMinute;

      const todayHours = resolveTodaySchedule(hours, dayOfWeek);
      if (!todayHours || isDayClosed(todayHours)) return false;

      const morningOk = inWindow(
        parseTimeToMinutes(todayHours.openTime || todayHours.open),
        parseTimeToMinutes(todayHours.closeTime || todayHours.close),
        currentTimeInMinutes,
      );
      const eveningOk = inWindow(
        parseTimeToMinutes(todayHours.eveningOpen),
        parseTimeToMinutes(todayHours.eveningClose),
        currentTimeInMinutes,
      );

      if (morningOk === null && eveningOk === null) {
        // Si no hay horarios válidos, asumimos abierto
        return true;
      }
      return morningOk === true || eveningOk === true;
    } catch {
      return true;
    }
  }

  // Update all businesses based on their schedules
  static async updateAllBusinessStatuses(): Promise<void> {
    const allBusinesses = await db.select().from(businesses);

    for (const business of allBusinesses) {
      if (!business.openingHours) continue;

      const shouldBeOpen = await this.isBusinessOpen(business.id);

      if (business.isOpen !== shouldBeOpen) {
        await db
          .update(businesses)
          .set({ isOpen: shouldBeOpen })
          .where(eq(businesses.id, business.id));

        console.log(
          `📍 ${business.name}: ${shouldBeOpen ? "ABIERTO" : "CERRADO"}`,
        );
      }
    }
  }
}