import { elapsed } from "./duration";

/**
 * Create a new timer and starts the timing right away. Returns a closed object
 * instead of a class to make sure the variables are bound correctly.
 */
export function timer() {
  const obj = {
    startMs: Date.now(),
    endMs: 0,

    stop(): void {
      obj.endMs = Date.now();
    },

    restart(): void {
      obj.endMs = 0;
      obj.startMs = Date.now();
    },

    elapsedMs(): number {
      const stopMs = obj.endMs || Date.now();
      return stopMs - obj.startMs;
    },

    toString(): string {
      return elapsed(obj.elapsedMs());
    },
  };

  return obj;
}

/** Defines the type of the Timer object. */
export type Timer = ReturnType<typeof timer>;
