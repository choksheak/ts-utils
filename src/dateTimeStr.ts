export type AnyDateTime = number | Date | string;

/**
 * Convert a number (epoch milliseconds), string (parseable date/time), or
 * Date object (no conversion) into a Date object.
 */
export function toDate(ts: AnyDateTime): Date {
  if (typeof ts === "number" || typeof ts === "string") {
    return new Date(ts);
  }

  return ts;
}

/**
 * Returns a date in yyyy-MM format. E.g. '2000-01'.
 *
 * @param dt Specify a date object or default to the current date.
 * @param separator Defaults to '-'.
 */
export function yyyyMm(dt = new Date(), separator = "-"): string {
  const yr = dt.getFullYear();
  const mth = dt.getMonth() + 1;

  return yr + separator + (mth < 10 ? "0" + mth : mth);
}

/**
 * Returns a date in yyyy-MM-dd format. E.g. '2000-01-02'.
 *
 * @param dt Specify a date object or default to the current date.
 * @param separator Defaults to '-'.
 */
export function yyyyMmDd(dt = new Date(), separator = "-"): string {
  const day = dt.getDate();

  return yyyyMm(dt, separator) + separator + (day < 10 ? "0" + day : day);
}

/**
 * Returns a date in hh:mm:ss format. E.g. '01:02:03'.
 *
 * @param dt Specify a date object or default to the current date/time.
 * @param separator Defaults to ':'.
 */
export function hhMmSs(dt = new Date(), separator = ":"): string {
  const hr = dt.getHours();
  const min = dt.getMinutes();
  const sec = dt.getSeconds();

  return (
    (hr < 10 ? "0" + hr : hr) +
    separator +
    (min < 10 ? "0" + min : min) +
    separator +
    (sec < 10 ? "0" + sec : sec)
  );
}

/**
 * Returns a date in hh:mm:ss.SSS format. E.g. '01:02:03.004'.
 *
 * @param dt Specify a date object or default to the current date/time.
 * @param timeSeparator Separator for hh/mm/ss. Defaults to ':'.
 * @param msSeparator Separator before SSS. Defaults to '.'.
 */
export function hhMmSsMs(
  dt = new Date(),
  timeSeparator = ":",
  msSeparator = ".",
): string {
  const ms = dt.getMilliseconds();

  return (
    hhMmSs(dt, timeSeparator) +
    msSeparator +
    (ms < 10 ? "00" + ms : ms < 100 ? "0" + ms : ms)
  );
}

/**
 * Returns the timezone string for the given date. E.g. '+8', '-3.5'.
 * Returns 'Z' for UTC.
 *
 * @param dt Specify a date object or default to the current date/time.
 */
export function tzShort(dt = new Date()): string {
  if (dt.getTimezoneOffset() === 0) {
    return "Z";
  }

  const tzHours = dt.getTimezoneOffset() / 60;
  return tzHours >= 0 ? "+" + tzHours : String(tzHours);
}

/**
 * Returns the long month name, zero-indexed. E.g. 0 for 'January'.
 *
 * @param month Zero-indexed month.
 * @param locales Specify the locale, e.g. 'en-US', new Intl.Locale("en-US").
 */
export function getLongMonthNameZeroIndexed(
  month: number,
  locales: Intl.LocalesArgument = "default",
): string {
  return new Date(2024, month, 15).toLocaleString(locales, {
    month: "long",
  });
}

/**
 * Returns the long month name, one-indexed. E.g. 1 for 'January'.
 *
 * @param month One-indexed month.
 * @param locales Specify the locale, e.g. 'en-US', new Intl.Locale("en-US").
 */
export function getLongMonthNameOneIndexed(
  month: number,
  locales: Intl.LocalesArgument = "default",
): string {
  return getLongMonthNameZeroIndexed(month - 1, locales);
}

/**
 * Returns the short month name, zero-indexed. E.g. 0 for 'Jan'.
 *
 * @param month Zero-indexed month.
 * @param locales Specify the locale, e.g. 'en-US', new Intl.Locale("en-US").
 */
export function getShortMonthNameZeroIndexed(
  month: number,
  locales: Intl.LocalesArgument = "default",
): string {
  return new Date(2000, month, 15).toLocaleString(locales, {
    month: "short",
  });
}

/**
 * Returns the short month name, one-indexed. E.g. 1 for 'Jan'.
 *
 * @param month One-indexed month.
 * @param locales Specify the locale, e.g. 'en-US', new Intl.Locale("en-US").
 */
export function getShortMonthNameOneIndexed(
  month: number,
  locales: Intl.LocalesArgument = "default",
): string {
  return getShortMonthNameZeroIndexed(month - 1, locales);
}

/**
 * Returns a human-readable string date/time like '2025-01-01 22:31:16Z'.
 * Excludes the milliseconds assuming it is not necessary for display.
 */
export function getDisplayDateTime(ts: AnyDateTime) {
  const iso = toDate(ts).toISOString();
  const noMs = iso.slice(0, 19) + "Z";
  return noMs.replace("T", " ");
}
