/**
 * Base 64 encode the given input string, but safely.
 */
export function safeBtoa(input: string): string {
  // Convert the string to a UTF-8 encoded binary-safe string
  const utf8Bytes = new TextEncoder().encode(input);

  // Convert the binary data to a string for btoa
  const binaryString = Array.from(utf8Bytes)
    .map((byte) => String.fromCodePoint(byte))
    .join("");

  // Use btoa to encode the binary-safe string
  return btoa(binaryString);
}
