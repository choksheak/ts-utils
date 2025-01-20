import { durationToMs, formatDuration, readableDuration } from "./duration";

describe("formatDuration", () => {
  test("empty", () => {
    expect(formatDuration({})).toBe("");
  });

  test("full short", () => {
    expect(
      formatDuration({
        days: 0,
        hours: 1,
        minutes: 2,
        seconds: 0,
        milliseconds: 1,
      }),
    ).toBe("0 days, 1 hr, 2 mins, 0 secs, 1 ms");
  });

  test("partial long", () => {
    expect(
      formatDuration(
        {
          days: 0,
          minutes: 2,
          milliseconds: 1,
        },
        "long",
      ),
    ).toBe("0 days, 2 minutes, 1 millisecond");
  });

  test("partial narrow", () => {
    expect(
      formatDuration(
        {
          hours: 1,
          seconds: 0,
        },
        "narrow",
      ),
    ).toBe("1h 0s");
  });
});

describe("readableDuration & durationToMs", () => {
  test("empty", () => {
    expect(readableDuration(0)).toBe("0 ms");

    expect(durationToMs({})).toBe(0);
  });

  test("full short", () => {
    expect(readableDuration(1234567890)).toBe(
      "14 days, 6 hrs, 56 mins, 7 secs, 890 ms",
    );

    expect(
      durationToMs({
        days: 14,
        hours: 6,
        minutes: 56,
        seconds: 7,
        milliseconds: 890,
      }),
    ).toBe(1234567890);
  });

  test("partial long", () => {
    expect(readableDuration(1212960890, { style: "long" })).toBe(
      "14 days, 56 minutes, 890 milliseconds",
    );

    expect(
      durationToMs({
        days: 14,
        minutes: 56,
        milliseconds: 890,
      }),
    ).toBe(1212960890);
  });

  test("partial narrow", () => {
    expect(readableDuration(21607000, { style: "narrow" })).toBe("6h 7s");

    expect(
      durationToMs({
        hours: 6,
        seconds: 7,
      }),
    ).toBe(21607000);
  });
});
