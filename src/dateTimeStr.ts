export class DateTimeStr {
  public static yyyyMmDd(dt = new Date(), separator = "-"): string {
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

  public static hhMmSs(dt = new Date(), separator = ":"): string {
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

  public static hhMmSsMs(
    dt = new Date(),
    timeSeparator = ":",
    msSeparator = ".",
  ): string {
    const ms = dt.getMilliseconds();

    return (
      DateTimeStr.hhMmSs(dt, timeSeparator) +
      msSeparator +
      (ms < 10 ? "00" + ms : ms < 100 ? "0" + ms : ms)
    );
  }

  public static tz(dt = new Date()): string {
    if (dt.getTimezoneOffset() === 0) {
      return "Z";
    }

    const tzHours = dt.getTimezoneOffset() / 60;
    return tzHours >= 0 ? "+" + tzHours : String(tzHours);
  }

  /** Full local date/time string. */
  public static local(
    dt = new Date(),
    dateSeparator = "-",
    dtSeparator = " ",
    timeSeparator = ":",
    msSeparator = ".",
  ): string {
    return (
      DateTimeStr.yyyyMmDd(dt, dateSeparator) +
      dtSeparator +
      DateTimeStr.hhMmSsMs(dt, timeSeparator, msSeparator) +
      DateTimeStr.tz(dt)
    );
  }

  /** Use the default ISO string function to keep things simple here. */
  public static utc(dt = new Date()) {
    return dt.toISOString();
  }

  /** Default full local date+time string with full & concise info. */
  public static get now() {
    return DateTimeStr.local();
  }

  /** Default full UTC date+time string with full & concise info. */
  public static get utcNow() {
    return DateTimeStr.utc();
  }
}
