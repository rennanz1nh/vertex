import { randomBytes, createHash, timingSafeEqual } from "crypto";

/** Opaque random token (256 bits), used for authorization codes and access/refresh tokens. */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

/** One-way digest used to look up a stored token/code without ever keeping the plaintext at rest. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** RFC 7636 PKCE: verifies `code_verifier` against the `code_challenge` minted at /authorize (S256 only — `plain` is not accepted). */
export function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  const computed = createHash("sha256").update(codeVerifier).digest("base64url");
  return safeEqual(computed, codeChallenge);
}
