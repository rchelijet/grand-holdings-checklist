import type { Frequency } from "./types";

const APP_TIME_ZONE = process.env.APP_TIME_ZONE || "Africa/Johannesburg";
const calendarFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

interface CalendarDateParts {
  year: number;
  month: number;
  day: number;
}

function calendarDateParts(date: Date): CalendarDateParts {
  const parts = calendarFormatter.formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
  };
}

function makeCalendarDate({ year, month, day }: CalendarDateParts): Date {
  // Noon UTC avoids server-local timezone changes affecting date-only values.
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function formatDateKey(date: Date): string {
  const { year, month, day } = calendarDateParts(date);
  return `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

export function parseDateKey(key: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) throw new Error(`Invalid date key: ${key}`);
  return makeCalendarDate({
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  });
}

function dayOfWeek({ year, month, day }: CalendarDateParts): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Current due date for a checklist frequency (the period the user must complete). */
export function getCurrentDueDate(
  frequency: Frequency,
  referenceDate: Date = new Date()
): Date {
  const today = calendarDateParts(referenceDate);

  switch (frequency) {
    case "daily":
      return makeCalendarDate(today);
    case "weekly":
      return makeCalendarDate({
        ...today,
        day: today.day - ((dayOfWeek(today) + 6) % 7),
      });
    case "monthly":
      return makeCalendarDate({ year: today.year, month: today.month, day: 1 });
    case "quarterly": {
      const quarterStartMonth = Math.floor((today.month - 1) / 3) * 3 + 1;
      return makeCalendarDate({
        year: today.year,
        month: quarterStartMonth,
        day: 1,
      });
    }
    case "yearly":
      return makeCalendarDate({ year: today.year, month: 1, day: 1 });
  }
}

/** Whether a date is a valid period start for this frequency. */
export function isValidPeriodDueDate(
  frequency: Frequency,
  dueDate: string
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return false;
  try {
    const parsed = parseDateKey(dueDate);
    return formatDateKey(getCurrentDueDate(frequency, parsed)) === dueDate;
  } catch {
    return false;
  }
}

export function getCurrentPeriodDueDateKey(
  frequency: Frequency,
  referenceDate: Date = new Date()
): string {
  return formatDateKey(getCurrentDueDate(frequency, referenceDate));
}

/** Whether a due date is exactly the current period. */
export function isCurrentPeriodDueDate(
  frequency: Frequency,
  dueDate: string,
  referenceDate: Date = new Date()
): boolean {
  return (
    isValidPeriodDueDate(frequency, dueDate) &&
    dueDate === getCurrentPeriodDueDateKey(frequency, referenceDate)
  );
}

/** Whether a due date belongs to a period before the current one. */
export function isPastPeriodDueDate(
  frequency: Frequency,
  dueDate: string,
  referenceDate: Date = new Date()
): boolean {
  return (
    isValidPeriodDueDate(frequency, dueDate) &&
    dueDate < getCurrentPeriodDueDateKey(frequency, referenceDate)
  );
}

/** @deprecated Use isCurrentPeriodDueDate instead. */
export function isDueDate(
  frequency: Frequency,
  dueDate: string,
  referenceDate: Date = new Date()
): boolean {
  return isCurrentPeriodDueDate(frequency, dueDate, referenceDate);
}

export interface CompletionPeriod {
  id: number;
  dueDate: string;
  status: string;
}

export function getPendingPeriods(
  frequency: Frequency,
  referenceDate: Date,
  completions: CompletionPeriod[]
): { dueDate: string; completionId: number | null }[] {
  const currentDueDate = getCurrentPeriodDueDateKey(frequency, referenceDate);
  const currentCompletion = completions.find(
    (completion) => completion.dueDate === currentDueDate
  );

  if (currentCompletion?.status === "completed") {
    return [];
  }

  return [
    {
      dueDate: currentDueDate,
      completionId: currentCompletion?.id ?? null,
    },
  ];
}

export function frequencyLabel(frequency: Frequency): string {
  const labels: Record<Frequency, string> = {
    daily: "Daily",
    weekly: "Weekly (every Monday)",
    monthly: "Monthly (1st of month)",
    quarterly: "Quarterly (Jan, Apr, Jul, Oct)",
    yearly: "Yearly (1st of January)",
  };
  return labels[frequency];
}

/** All due dates for a frequency within [start, end] inclusive. */
export function getDueDatesInRange(
  frequency: Frequency,
  start: Date,
  end: Date
): Date[] {
  const dates: Date[] = [];
  const startDay = parseDateKey(formatDateKey(start));
  const endDay = parseDateKey(formatDateKey(end));
  let cursor = getCurrentDueDate(frequency, startDay);

  if (cursor.getTime() < startDay.getTime()) {
    cursor = advanceCursor(frequency, cursor);
  }

  while (cursor.getTime() <= endDay.getTime()) {
    dates.push(getCurrentDueDate(frequency, cursor));
    cursor = advanceCursor(frequency, cursor);
  }

  const seen = new Set<string>();
  return dates.filter((d) => {
    const key = formatDateKey(d);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function addCalendarDays(dateKey: string, days: number): string {
  const { year, month, day } = calendarDateParts(parseDateKey(dateKey));
  return formatDateKey(new Date(Date.UTC(year, month - 1, day + days, 12)));
}

function advanceCursor(frequency: Frequency, date: Date): Date {
  const d = calendarDateParts(date);
  switch (frequency) {
    case "daily":
      return makeCalendarDate({ ...d, day: d.day + 1 });
    case "weekly":
      return makeCalendarDate({ ...d, day: d.day + 7 });
    case "monthly":
      return makeCalendarDate({
        year: d.month === 12 ? d.year + 1 : d.year,
        month: d.month === 12 ? 1 : d.month + 1,
        day: 1,
      });
    case "quarterly":
      return makeCalendarDate({
        year: d.month > 9 ? d.year + 1 : d.year,
        month: d.month > 9 ? d.month - 9 : d.month + 3,
        day: 1,
      });
    case "yearly":
      return makeCalendarDate({ year: d.year + 1, month: 1, day: 1 });
  }
}
