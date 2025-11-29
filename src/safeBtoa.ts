/**
 * Base 64 encode the given input string, but safely.
 *
 * Why using btoa() directly might not always work:
 * btoa() expects a "binary string" where each character is represented by a
 * single byte (0-255). Modern JavaScript strings, however, are encoded in
 * UTF-16 and can contain characters that require more than one byte (i.e.,
 * characters outside the Latin-1 range, such as those with code points greater
 * than 255).
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
