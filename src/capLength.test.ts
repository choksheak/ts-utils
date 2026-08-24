import { describe, expect, test } from "vitest";

import { capLength } from "./capLength";

describe("capLength", () => {
  test("undefined", () => {
    expect(capLength(undefined)).toBe("undefined");
  });
});
