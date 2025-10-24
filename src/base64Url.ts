/**
 * Convert a base64 string to a base64url string.
 */
export function base64ToBase64URL(base64: string): string {
    return base64
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, ''); // Remove padding
}

/**
 * Convert a base64url string to a base64 string.
 */
export function base64UrlToBase64(base64Url: string): string {
    if (!base64Url) return '';

    // Replace URL-safe characters
    const base64 = base64Url
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    // Calculate and add padding
    const padLength = (4 - (base64.length % 4)) % 4;
    return base64 + '='.repeat(padLength);
}
