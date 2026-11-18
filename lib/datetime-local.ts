/**
 * Format a Date for <input type="datetime-local"> in the viewer's LOCAL time.
 *
 * The input reads and writes local wall-clock time. Filling it from
 * toISOString() (UTC) made every save of a form shift its open/close dates by
 * the UTC offset (7 hours earlier in WIB).
 */
export function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
