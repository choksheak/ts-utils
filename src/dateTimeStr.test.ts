import { assert } from "./assert";
import { DateTimeStr } from "./dateTimeStr";

describe("DateTimeStr", () => {
  const dt1 = new Date(2024, 3, 6, 7, 9, 1, 4);
  const dt2 = new Date(2024, 10, 12, 13, 14, 15, 16);
  const dt3 = new Date(2024, 11, 31, 20, 21, 22, 234);

  test("yyyyMmDd", () => {
    expect(DateTimeStr.yyyyMmDd(dt1)).toBe("2024-04-06");
    expect(DateTimeStr.yyyyMmDd(dt2)).toBe("2024-11-12");

    expect(DateTimeStr.yyyyMmDd(dt1, "/")).toBe("2024/04/06");
    expect(DateTimeStr.yyyyMmDd(dt2, "+*")).toBe("2024+*11+*12");
  });

  test("hhMmSs", () => {
    expect(DateTimeStr.hhMmSs(dt1)).toBe("07:09:01");
    expect(DateTimeStr.hhMmSs(dt2)).toBe("13:14:15");

    expect(DateTimeStr.hhMmSs(dt1, "/")).toBe("07/09/01");
    expect(DateTimeStr.hhMmSs(dt2, "+*")).toBe("13+*14+*15");
  });

  test("hhMmSsMs", () => {
    expect(DateTimeStr.hhMmSsMs(dt1)).toBe("07:09:01.004");
    expect(DateTimeStr.hhMmSsMs(dt2)).toBe("13:14:15.016");
    expect(DateTimeStr.hhMmSsMs(dt3)).toBe("20:21:22.234");

    expect(DateTimeStr.hhMmSsMs(dt1, "/", "-")).toBe("07/09/01-004");
    expect(DateTimeStr.hhMmSsMs(dt2, "+*", "^%")).toBe("13+*14+*15^%016");
    expect(DateTimeStr.hhMmSsMs(dt3, "-", "#")).toBe("20-21-22#234");
  });

  test("local", () => {
    // Skip timezone matching as it cannot be set in the test.
    let t = DateTimeStr.local(dt1);
    assert(t.startsWith("2024-04-06 07:09:01.004"), t);

    t = DateTimeStr.local(dt2, "/", "@", ".", "+");
    assert(t.startsWith("2024/11/12@13.14.15+016"), t);

    t = DateTimeStr.local(dt3, ".", "t", "#", "%");
    assert(t.startsWith("2024.12.31t20#21#22%234"), t);
  });
});
