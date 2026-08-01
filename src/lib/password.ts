/**
 * The auth backend enforces a hard minimum of 6 characters for passwords.
 * To let people use very short/easy passwords (even a single character),
 * we deterministically extend anything shorter than 6 chars with a fixed
 * suffix before sending it to the auth API.
 *
 * This MUST be applied identically on sign-up, sign-in and password change,
 * otherwise users would not be able to log back in.
 */
const PAD = "Bh1!x9";

export function normalizePassword(pw: string): string {
  if (!pw) return pw;
  return pw.length >= 6 ? pw : pw + PAD;
}
