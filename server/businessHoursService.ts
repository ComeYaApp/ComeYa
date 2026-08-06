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
  // get timezone string from env, default to Caracas
  const timezone = process.env.BUSINESS_TIMEZONE || "America/Caracas";
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

function resolveTodaySchedule(
  hours: any,
  dayOfWeek: number,
): DaySchedule | null {
  if (!hours) return null;

  // ─── CASO 1: Array ────────────────────────────────────────────────────
  if (Array.isArray(hours)) {
    const byIndex = hours[dayOfWeek];
    if (byIndex && !isDayClosed(byIndex) && (byIndex.openTime || byIndex.open) && (byIndex.closeTime || byIndex.close)) {
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
  if (byKey && !isDayClosed(byKey) && (byKey.openTime || byKey.open) && (byKey.closeTime || byKey.close)) {
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

export class BusinessHoursService {
  // Check if business should be open based on current time
  static async isBusinessOpen(businessId: string): Promise<boolean> {
    const [business] = await db
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

      // Soporta tanto open/openTime como close/closeTime
      const openValue = todayHours.openTime || todayHours.open;
      const closeValue = todayHours.closeTime || todayHours.close;

      const openTimeInMinutes = parseTimeToMinutes(openValue);
      const closeTimeInMinutes = parseTimeToMinutes(closeValue);

      if (openTimeInMinutes === null || closeTimeInMinutes === null) {
        // Si no hay horarios válidos, asumimos abierto
        return true;
      }

      // Caso: horario nocturno (ej. 22:00 - 02:00)
      if (closeTimeInMinutes < openTimeInMinutes) {
        return (
          currentTimeInMinutes >= openTimeInMinutes ||
          currentTimeInMinutes <= closeTimeInMinutes
        );
      }

      return (
        currentTimeInMinutes >= openTimeInMinutes &&
        currentTimeInMinutes <= closeTimeInMinutes
      );
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