import { timer } from "./timer";

describe("timer", () => {
  test("toString ms", async () => {
    const t = timer();
    t.endMs = t.startMs + 10;
    expect(`${t}`).toBe("10ms");
  });

  test("toString sec", async () => {
    const t = timer();
    t.endMs = t.startMs + 101;
    expect(`${t}`).toBe("0.101s");
  });

  test("toString min", async () => {
    const t = timer();
    t.endMs = t.startMs + 60_001;
    expect(`${t}`).toBe("1 min, 1 ms");
  });
});
