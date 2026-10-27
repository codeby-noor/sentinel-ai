/** Client-side auth validation. Rule mirror of apps/api password-policy.ts. */
export const PASSWORD_RULE_MESSAGE = 'Password must be exactly 8 characters.';

export function isPasswordLengthValid(p: unknown): p is string {
  return typeof p === 'string' && p.length === 8;
}

export function isEmailValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
