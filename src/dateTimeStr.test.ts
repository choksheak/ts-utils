import {
  getDisplayDateTime,
  getLongMonthNameOneIndexed,
  getLongMonthNameZeroIndexed,
  getShortMonthNameOneIndexed,
  getShortMonthNameZeroIndexed,
  hhMm,
  hhMmSs,
  hhMmSsMs,
  yyyyMm,
  yyyyMmDd,
} from "./dateTimeStr";

describe("DateTimeStr", () => {
  const dt1 = new Date(2024, 3, 6, 7, 9, 1, 4);
  const dt2 = new Date(2024, 10, 12, 13, 14, 15, 16);
  const dt3 = new Date(2024, 11, 31, 20, 21, 22, 234);
  const enUS = new Intl.Locale("en-US");

  test("yyyyMm", () => {
    expect(yyyyMm(dt1)).toBe("2024-04");
    expect(yyyyMm(dt2)).toBe("2024-11");

    expect(yyyyMm(dt1, "/")).toBe("2024/04");
    expect(yyyyMm(dt2, "+*")).toBe("2024+*11");
  });

  test("yyyyMmDd", () => {
    expect(yyyyMmDd(dt1)).toBe("2024-04-06");
    expect(yyyyMmDd(dt2)).toBe("2024-11-12");

    expect(yyyyMmDd(dt1, "/")).toBe("2024/04/06");
    expect(yyyyMmDd(dt2, "+*")).toBe("2024+*11+*12");
  });

  test("hhMm", () => {
    expect(hhMm(dt1)).toBe("07:09");
    expect(hhMm(dt2)).toBe("13:14");

    expect(hhMm(dt1, "/")).toBe("07/09");
    expect(hhMm(dt2, "+*")).toBe("13+*14");
  });

  test("hhMmSs", () => {
    expect(hhMmSs(dt1)).toBe("07:09:01");
    expect(hhMmSs(dt2)).toBe("13:14:15");

    expect(hhMmSs(dt1, "/")).toBe("07/09/01");
    expect(hhMmSs(dt2, "+*")).toBe("13+*14+*15");
  });

  test("hhMmSsMs", () => {
    expect(hhMmSsMs(dt1)).toBe("07:09:01.004");
    expect(hhMmSsMs(dt2)).toBe("13:14:15.016");
    expect(hhMmSsMs(dt3)).toBe("20:21:22.234");

    expect(hhMmSsMs(dt1, "/", "-")).toBe("07/09/01-004");
    expect(hhMmSsMs(dt2, "+*", "^%")).toBe("13+*14+*15^%016");
    expect(hhMmSsMs(dt3, "-", "#")).toBe("20-21-22#234");
  });

  test("Get month name", () => {
    expect(getLongMonthNameZeroIndexed(0, "en-US")).toBe("January");
    expect(getLongMonthNameOneIndexed(1, enUS)).toBe("January");

    expect(getShortMonthNameZeroIndexed(0, enUS)).toBe("Jan");
    expect(getShortMonthNameOneIndexed(1, "en-US")).toBe("Jan");
  });

  test("getDisplayDateTime", () => {
    expect(getDisplayDateTime("2025-01-01T19:43:08.123Z")).toBe(
      "2025-01-01 19:43:08Z",
    );
  });
});
