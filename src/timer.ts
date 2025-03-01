import { elapsed } from "./duration";

export class Timer {
  public startMs: number;
  public endMs = 0;

  public constructor() {
    this.startMs = Date.now();
  }

  public stop(): void {
    this.endMs = Date.now();
  }

  public restart(): void {
    this.endMs = 0;
    this.startMs = Date.now();
  }

  public elapsedMs(): number {
    const stopMs = this.endMs || Date.now();
    return stopMs - this.startMs;
  }

  public toString(): string {
    return elapsed(this.elapsedMs());
  }
}

/** Shorthand for `new Timer()` to make this easier to use. */
export function timer(): Timer {
  return new Timer();
}
