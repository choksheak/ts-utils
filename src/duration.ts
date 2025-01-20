/**
 * Bunch of miscellaneous constants and utility functions related to handling
 * date and time durations.
 *
 * Note that month and year do not have fixed durations, and hence are excluded
 * from this file. Weeks have fixed durations, but are excluded because we
 * use days as the max duration supported.
 */

import {
  MS_PER_SECOND,
  SECONDS_PER_MINUTE,
  MINUTES_PER_HOUR,
  HOURS_PER_DAY,
  MS_PER_DAY,
  MS_PER_MINUTE,
  MS_PER_HOUR,
} from "./timeConstants";

export type Duration = {
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
  milliseconds?: number;
};

/**
 * One of: days, hours, minutes, seconds, milliseconds
 */
export type DurationType = keyof Duration;

/**
 * Order in which the duration type appears in the duration string.
 */
export const DURATION_TYPE_SEQUENCE: DurationType[] = [
  "days",
  "hours",
  "minutes",
  "seconds",
  "milliseconds",
];

/**
 * Follows the same format as Intl.DurationFormat.prototype.format().
 *
 * Short: 1 yr, 2 mths, 3 wks, 3 days, 4 hr, 5 min, 6 sec, 7 ms, 8 μs, 9 ns
 * Long: 1 year, 2 months, 3 weeks, 3 days, 4 hours, 5 minutes, 6 seconds,
 *       7 milliseconds, 8 microseconds, 9 nanoseconds
 * Narrow: 1y 2mo 3w 3d 4h 5m 6s 7ms 8μs 9ns
 */
export type DurationStyle = "short" | "long" | "narrow";

export type DurationSuffixMap = {
  short: string;
  shorts: string;
  long: string;
  longs: string;
  narrow: string;
};

export type DurationSuffixType = keyof DurationSuffixMap;

export const DURATION_STYLE_SUFFIX_MAP: Record<
  DurationType,
  DurationSuffixMap
> = {
  days: {
    short: "day",
    shorts: "days",
    long: "day",
    longs: "days",
    narrow: "d",
  },
  hours: {
    short: "hr",
    shorts: "hrs",
    long: "hour",
    longs: "hours",
    narrow: "h",
  },
  minutes: {
    short: "min",
    shorts: "mins",
    long: "minute",
    longs: "minutes",
    narrow: "m",
  },
  seconds: {
    short: "sec",
    shorts: "secs",
    long: "second",
    longs: "seconds",
    narrow: "s",
  },
  milliseconds: {
    short: "ms",
    shorts: "ms",
    long: "millisecond",
    longs: "milliseconds",
    narrow: "ms",
  },
};

function getDurationStyleForPlural(style: DurationStyle): DurationSuffixType {
  return style == "short" ? "shorts" : style === "long" ? "longs" : style;
}

function getValueAndUnitSeparator(style: DurationStyle): string {
  return style === "narrow" ? "" : " ";
}

function getDurationTypeSeparator(style: DurationStyle): string {
  return style === "narrow" ? " " : ", ";
}

/**
 * Convert a milliseconds duration into a Duration object. If the given ms is
 * zero, then return an object with a single field of zero with duration type
 * of durationTypeForZero.
 *
 * @param durationTypeForZero Defaults to 'milliseconds'
 */
export function msToDuration(
  ms: number,
  durationTypeForZero?: DurationType,
): Duration {
  if (ms === 0) {
    durationTypeForZero = durationTypeForZero ?? "milliseconds";
    return { [durationTypeForZero]: 0 };
  }

  const duration: Duration = {};

  for (let i = 0; i < 1; i++) {
    let seconds = Math.floor(ms / MS_PER_SECOND);
    const millis = ms - seconds * MS_PER_SECOND;

    if (millis > 0) {
      duration["milliseconds"] = millis;
    }

    if (seconds === 0) {
      break;
    }

    let minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
    seconds -= minutes * SECONDS_PER_MINUTE;

    if (seconds > 0) {
      duration["seconds"] = seconds;
    }

    if (minutes === 0) {
      break;
    }

    let hours = Math.floor(minutes / MINUTES_PER_HOUR);
    minutes -= hours * MINUTES_PER_HOUR;

    if (minutes > 0) {
      duration["minutes"] = minutes;
    }

    if (hours === 0) {
      break;
    }

    const days = Math.floor(hours / HOURS_PER_DAY);
    hours -= days * HOURS_PER_DAY;

    if (hours > 0) {
      duration["hours"] = hours;
    }

    if (days > 0) {
      duration["days"] = days;
    }
  }

  return duration;
}

/**
 * Returns the number of milliseconds for the given duration.
 */
export function durationToMs(duration: Duration): number {
  const daysMs = (duration.days ?? 0) * MS_PER_DAY;
  const hoursMs = (duration.hours ?? 0) * MS_PER_HOUR;
  const minsMs = (duration.minutes ?? 0) * MS_PER_MINUTE;
  const secsMs = (duration.seconds ?? 0) * MS_PER_SECOND;
  const msMs = duration.milliseconds ?? 0;

  return daysMs + hoursMs + minsMs + secsMs + msMs;
}

/**
 * Format a given Duration object into a string. If the object has no fields,
 * then returns an empty string.
 *
 * @param style Defaults to 'short'
 */
export function formatDuration(duration: Duration, style?: DurationStyle) {
  style = style ?? "short";
  const stylePlural = getDurationStyleForPlural(style);

  const space = getValueAndUnitSeparator(style);

  const a: string[] = [];

  for (const unit of DURATION_TYPE_SEQUENCE) {
    const value = duration[unit];
    if (value === undefined) continue;

    const suffixMap = DURATION_STYLE_SUFFIX_MAP[unit];
    const suffix = value === 1 ? suffixMap[style] : suffixMap[stylePlural];
    a.push(value + space + suffix);
  }

  const separator = getDurationTypeSeparator(style);
  return a.join(separator);
}

/**
 * Convert a millisecond duration into a human-readable duration string.
 *
 * @param options.durationTypeForZero - Defaults to 'milliseconds'
 * @param options.style - Defaults to 'short'
 */
export function readableDuration(
  ms: number,
  options?: { durationTypeForZero?: DurationType; style?: DurationStyle },
): string {
  const duration = msToDuration(ms, options?.durationTypeForZero);

  return formatDuration(duration, options?.style);
}
