import { hhMmSs, hhMmSsMs, yyyyMmDd } from "./dateTimeStr";

describe("DateTimeStr", () => {
  const dt1 = new Date(2024, 3, 6, 7, 9, 1, 4);
  const dt2 = new Date(2024, 10, 12, 13, 14, 15, 16);
  const dt3 = new Date(2024, 11, 31, 20, 21, 22, 234);

  test("yyyyMmDd", () => {
    expect(yyyyMmDd(dt1)).toBe("2024-04-06");
    expect(yyyyMmDd(dt2)).toBe("2024-11-12");

    expect(yyyyMmDd(dt1, "/")).toBe("2024/04/06");
    expect(yyyyMmDd(dt2, "+*")).toBe("2024+*11+*12");
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
});
