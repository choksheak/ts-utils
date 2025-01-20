export function yyyyMmDd(dt = new Date(), separator = "-"): string {
  const yr = dt.getFullYear();
  const mth = dt.getMonth() + 1;
  const day = dt.getDate();

  return (
    yr +
    separator +
    (mth < 10 ? "0" + mth : mth) +
    separator +
    (day < 10 ? "0" + day : day)
  );
}

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

export function tzShort(dt = new Date()): string {
  if (dt.getTimezoneOffset() === 0) {
    return "Z";
  }

  const tzHours = dt.getTimezoneOffset() / 60;
  return tzHours >= 0 ? "+" + tzHours : String(tzHours);
}
