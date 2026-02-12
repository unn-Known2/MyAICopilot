/**
 * Web-safe cryptographic utilities using Web Crypto API
 * Compatible with VS Code web and desktop
 */

/**
 * Compute SHA-256 hash of string content
 * Returns hex string
 */
export async function computeHash(content: string): Promise<string> {
  if (!content) return "0";

  try {
    // Modern Web Crypto API (works everywhere)
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (error) {
    // Fallback: djb2 algorithm (simple but decent distribution)
    console.warn("Web Crypto unavailable, using fallback hash");
    let hash = 5381;
    for (let i = 0; i < content.length; i++) {
      hash = (hash * 33) ^ content.charCodeAt(i);
    }
    return Math.abs(hash).toString(16);
  }
}

/**
 * Check if running in web environment
 */
export function isWeb(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof window !== "undefined" &&
    !(typeof process !== "undefined" && process.versions?.node)
  );
}
