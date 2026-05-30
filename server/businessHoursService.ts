import { db } from "./db";
import { businesses } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";

type DaySchedule = {
  isOpen?: boolean;
  openTime?: string;
  closeTime?: string;
  day?: string;
};

function getZonedNow(): Date {
  const timezone = process.env.BUSINESS_TIMEZONE || "America/Venezuela_City";
  return new Date(new Date().toLocaleString("en-US", { timeZone: timezone }));
}

function normalizeDayName(value?: string): string {
  return (value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function resolveTodaySchedule(
  hours: any,
  dayOfWeek: number,
): DaySchedule | null {
  if (!hours) return null;

  if (Array.isArray(hours)) {
    const byIndex = hours[dayOfWeek];
    if (byIndex?.openTime && byIndex?.closeTime) {
      return byIndex;
    }

    const todayName = normalizeDayName(
      [
        "domingo",
        "lunes",
        "martes",
        "miercoles",
        "jueves",
        "viernes",
        "sabado",
      ][dayOfWeek],
    );

    const byName = hours.find(
      (entry: DaySchedule) => normalizeDayName(entry?.day) === todayName,
    );
    return byName || null;
  }

  const byKey = hours[dayOfWeek] || hours[String(dayOfWeek)];
  if (byKey?.openTime && byKey?.closeTime) {
    return byKey;
  }

  const todayName = [
    "domingo",
    "lunes",
    "martes",
    "miercoles",
    "jueves",
    "viernes",
    "sabado",
  ][dayOfWeek];
  const dayNameKeys = Object.keys(hours);
  const namedKey = dayNameKeys.find(
    (key) => normalizeDayName(key) === todayName,
  );

  return namedKey ? hours[namedKey] : null;
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
      if (!todayHours || !todayHours.isOpen) return false;

      const openTimeInMinutes = parseTimeToMinutes(todayHours.openTime);
      const closeTimeInMinutes = parseTimeToMinutes(todayHours.closeTime);

      if (openTimeInMinutes === null || closeTimeInMinutes === null) {
        return true;
      }

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
