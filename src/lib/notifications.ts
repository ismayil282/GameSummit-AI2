export function localClock(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (key: string) => parts.find(p => p.type === key)!.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minute: Number(get("hour")) * 60 + Number(get("minute")) };
}
export function isNudgeDue(now: Date, timezone: string, preferredTime: string) {
  const clock = localClock(now, timezone);
  const [hour, minute] = preferredTime.split(":").map(Number);
  // Run at the first quarter-hour after the selected local minute.
  const elapsed = clock.minute - (hour * 60 + minute);
  return { ...clock, due: elapsed >= 0 && elapsed < 15 };
}
