import { isEmpty } from "./isEmpty";

test("isEmpty", () => {
  for (const t of [
    null,
    undefined,
    0,
    -0,
    false,
    NaN,
    "",
    [],
    {},
    new Set(),
    new Map(),
    new Blob(),
  ]) {
    if (!isEmpty(t)) {
      throw new Error(`${t} should be empty`);
    }
  }

  for (const t of [
    1,
    -1,
    true,
    " ",
    [1],
    { a: 1 },
    new Set([1]),
    new Map([["a", 1]]),
    new Blob(["a"]),
  ]) {
    if (isEmpty(t)) {
      throw new Error(`${t} should not be empty`);
    }
  }
});
