/**
 * Utility functions for business hours management.
 * Used by both server (to calculate isOpen) and client (to display hours).
 */

export interface DaySchedule {
  open: string;
  close: string;
  closed: boolean;
  eveningOpen?: string;
  eveningClose?: string;
}

export interface WeeklyHours {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export const DEFAULT_HOURS: WeeklyHours = {
  monday: { open: "09:00", close: "22:00", closed: false },
  tuesday: { open: "09:00", close: "22:00", closed: false },
  wednesday: { open: "09:00", close: "22:00", closed: false },
  thursday: { open: "09:00", close: "22:00", closed: false },
  friday: { open: "09:00", close: "22:00", closed: false },
  saturday: { open: "09:00", close: "22:00", closed: false },
  sunday: { open: "09:00", close: "22:00", closed: false },
};

const DAY_KEYS: (keyof WeeklyHours)[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

/**
 * Parse opening hours from JSON string or object.
 * Returns a complete WeeklyHours object with defaults for missing data.
 */
export function parseOpeningHours(raw: string | null | undefined): WeeklyHours {
  if (!raw) return { ...DEFAULT_HOURS };
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const result: any = {};
    for (const key of DAY_KEYS) {
      const dayData = parsed[key];
      if (!dayData || dayData.closed === true) {
        result[key] = { ...DEFAULT_HOURS[key], closed: true };
      } else {
        result[key] = {
          open: dayData.open || DEFAULT_HOURS[key].open,
          close: dayData.close || DEFAULT_HOURS[key].close,
          closed: false,
          eveningOpen: dayData.eveningOpen || undefined,
          eveningClose: dayData.eveningClose || undefined,
        };
      }
    }
    return result as WeeklyHours;
  } catch {
    return { ...DEFAULT_HOURS };
  }
}

/**
 * Convert time string "HH:MM" to minutes since midnight.
 */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

/**
 * Check if a specific time range is currently active.
 */
function isWithinTimeRange(nowMinutes: number, open: string, close: string): boolean {
  const openMin = timeToMinutes(open);
  const closeMin = timeToMinutes(close);

  // If close < open, it crosses midnight (e.g., 20:00 - 02:00)
  if (closeMin <= openMin) {
    return nowMinutes >= openMin || nowMinutes < closeMin;
  }
  return nowMinutes >= openMin && nowMinutes < closeMin;
}

/**
 * Determine if a business is currently open based on its opening hours and current time.
 *
 * @param openingHoursRaw - The opening_hours JSON string from the database.
 * @param isOpenManual - The manual isOpen flag from the database (owner toggle).
 * @param now - Optional Date override (defaults to current time).
 * @returns true if the business should be considered open right now.
 */
export function isBusinessOpen(
  openingHoursRaw: string | null | undefined,
  isOpenManual: boolean | number | string | null | undefined,
  now: Date = new Date(),
): boolean {
  // If the owner manually closed the business, respect that first
  const manualFlag = isOpenManual === true || isOpenManual === 1 || isOpenManual === "1";
  if (!manualFlag) return false;

  const hours = parseOpeningHours(openingHoursRaw);
  const dayIndex = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const dayKey = DAY_KEYS[dayIndex === 0 ? 6 : dayIndex - 1]; // Convert JS day to our keys
  const todaySchedule = hours[dayKey];

  // If the day is marked as closed
  if (todaySchedule.closed) return false;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Check morning shift
  if (isWithinTimeRange(nowMinutes, todaySchedule.open, todaySchedule.close)) {
    return true;
  }

  // Check evening shift if it exists
  if (todaySchedule.eveningOpen && todaySchedule.eveningClose) {
    if (
      isWithinTimeRange(
        nowMinutes,
        todaySchedule.eveningOpen,
        todaySchedule.eveningClose,
      )
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Format a DaySchedule for display in Spanish.
 * Returns a readable string like "9:00 - 16:00 y 20:00 - 23:00" or "Cerrado".
 */
export function formatScheduleForDay(day: DaySchedule): string {
  if (day.closed) return "Cerrado";
  let text = `${day.open} - ${day.close}`;
  if (day.eveningOpen && day.eveningClose) {
    text += ` y ${day.eveningOpen} - ${day.eveningClose}`;
  }
  return text;
}

export const DAY_LABELS_ES: Record<keyof WeeklyHours, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
};

/**
 * Format the full weekly schedule for display.
 * Returns an array of { dayLabel, schedule } objects.
 */
export function formatWeeklySchedule(raw: string | null | undefined): {
  dayLabel: string;
  schedule: string;
  isToday: boolean;
  isClosed: boolean;
}[] {
  const hours = parseOpeningHours(raw);
  const today = new Date();
  const todayIndex = today.getDay(); // 0 = Sunday
  const todayKey = DAY_KEYS[todayIndex === 0 ? 6 : todayIndex - 1];

  return DAY_KEYS.map((key) => {
    const day = hours[key];
    return {
      dayLabel: DAY_LABELS_ES[key],
      schedule: formatScheduleForDay(day),
      isToday: key === todayKey,
      isClosed: day.closed,
    };
  });
}