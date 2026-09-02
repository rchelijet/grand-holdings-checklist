import assert from "node:assert/strict";
import test from "node:test";
import {
  addCalendarDays,
  formatDateKey,
  getCurrentDueDate,
  getCurrentPeriodDueDateKey,
  getDueDatesInRange,
  getPendingPeriods,
  isCurrentPeriodDueDate,
  isPastPeriodDueDate,
} from "./schedule.ts";

const referenceDate = new Date("2026-08-31T12:00:00Z");

test("calculates recurring periods from the South African calendar", () => {
  assert.equal(formatDateKey(getCurrentDueDate("daily", referenceDate)), "2026-08-31");
  assert.equal(formatDateKey(getCurrentDueDate("weekly", referenceDate)), "2026-08-31");
  assert.equal(formatDateKey(getCurrentDueDate("monthly", referenceDate)), "2026-08-01");
  assert.equal(formatDateKey(getCurrentDueDate("quarterly", referenceDate)), "2026-07-01");
  assert.equal(formatDateKey(getCurrentDueDate("yearly", referenceDate)), "2026-01-01");
});

test("uses the configured calendar date around UTC midnight", () => {
  const justBeforeMidnightUtc = new Date("2026-08-31T21:59:59Z");
  const afterMidnightUtc = new Date("2026-08-31T22:00:00Z");

  assert.equal(formatDateKey(getCurrentDueDate("daily", justBeforeMidnightUtc)), "2026-08-31");
  assert.equal(formatDateKey(getCurrentDueDate("daily", afterMidnightUtc)), "2026-09-01");
});

test("returns only recurring dates inside an inclusive range", () => {
  const dates = getDueDatesInRange(
    "weekly",
    new Date("2026-08-30T12:00:00Z"),
    new Date("2026-09-02T12:00:00Z")
  );

  assert.deepEqual(dates.map(formatDateKey), ["2026-08-31"]);
});

test("shows only the current daily period when incomplete", () => {
  const periods = getPendingPeriods("daily", referenceDate, [
    { id: 10, dueDate: "2026-08-29", status: "pending" },
    { id: 11, dueDate: "2026-08-30", status: "completed" },
  ]);

  assert.deepEqual(periods, [{ dueDate: "2026-08-31", completionId: null }]);
});

test("hides a completed current period", () => {
  const periods = getPendingPeriods("weekly", referenceDate, [
    { id: 20, dueDate: "2026-08-31", status: "completed" },
    { id: 21, dueDate: "2026-08-24", status: "pending" },
  ]);

  assert.deepEqual(periods, []);
});

test("daily rollover exposes the new day only", () => {
  const nextDay = new Date("2026-09-01T12:00:00Z");
  const periods = getPendingPeriods("daily", nextDay, [
    { id: 10, dueDate: "2026-08-31", status: "pending" },
  ]);

  assert.deepEqual(periods, [{ dueDate: "2026-09-01", completionId: null }]);
  assert.equal(
    isPastPeriodDueDate("daily", "2026-08-31", nextDay),
    true
  );
  assert.equal(
    isCurrentPeriodDueDate("daily", "2026-08-31", nextDay),
    false
  );
});

test("weekly rollover moves pending to the new Monday", () => {
  const nextMonday = new Date("2026-09-07T12:00:00Z");
  const periods = getPendingPeriods("weekly", nextMonday, [
    { id: 30, dueDate: "2026-08-31", status: "pending" },
  ]);

  assert.equal(getCurrentPeriodDueDateKey("weekly", nextMonday), "2026-09-07");
  assert.deepEqual(periods, [{ dueDate: "2026-09-07", completionId: null }]);
  assert.equal(
    isPastPeriodDueDate("weekly", "2026-08-31", nextMonday),
    true
  );
});

test("monthly rollover starts the new month period", () => {
  const nextMonth = new Date("2026-09-15T12:00:00Z");
  const periods = getPendingPeriods("monthly", nextMonth, [
    { id: 40, dueDate: "2026-08-01", status: "pending" },
  ]);

  assert.equal(getCurrentPeriodDueDateKey("monthly", nextMonth), "2026-09-01");
  assert.deepEqual(periods, [{ dueDate: "2026-09-01", completionId: null }]);
  assert.equal(
    isPastPeriodDueDate("monthly", "2026-08-01", nextMonth),
    true
  );
});

test("addCalendarDays shifts date keys across month boundaries", () => {
  assert.equal(addCalendarDays("2026-09-01", -1), "2026-08-31");
  assert.equal(addCalendarDays("2026-08-31", 1), "2026-09-01");
});
