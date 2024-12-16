/**
 * Encode an input ArrayBuffer into a hex string.
 */
export function arrayBufferToHex(buffer: ArrayBuffer): string {
  // Create a Uint8Array view of the ArrayBuffer
  const byteArray = new Uint8Array(buffer);

  // Convert each byte to a two-character hexadecimal string
  return Array.from(byteArray)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Encode an input ArrayBuffer into a base64 string.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  // Convert the ArrayBuffer to a Uint8Array
  const byteArray = new Uint8Array(buffer);

  // Create a binary string from the byte array
  const binaryString = Array.from(byteArray)
    .map((byte) => String.fromCodePoint(byte))
    .join("");

  // Encode the binary string to base64. No need to use safeBtoa because we
  // already simplified the binary input above.
  return btoa(binaryString);
}
