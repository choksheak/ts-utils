import { toReadableString } from "./toReadableString";

export function capLength(u: unknown, maxLength = 400): string {
  const s = toReadableString(u);

  if (s.length <= maxLength) {
    return s;
  }

  return s.slice(0, maxLength) + ` ... (${s.length - maxLength} more)`;
}
