/**
 * SHA-256 hash an input string into an ArrayBuffer.
 */
export async function sha256(input: string): Promise<ArrayBuffer> {
  // Encode the input string as a Uint8Array
  const encoder = new TextEncoder();
  const uint8Array = encoder.encode(input);

  // Compute the SHA-256 hash using the SubtleCrypto API
  const arrayBuffer = await crypto.subtle.digest("SHA-256", uint8Array);

  return arrayBuffer;
}
