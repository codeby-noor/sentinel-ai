/** Shared password rule: exactly 8 characters. Mirrored in apps/web/lib/validation.ts. */
export const PASSWORD_RULE_MESSAGE = 'Password must be exactly 8 characters.';

export function isPasswordLengthValid(p: unknown): p is string {
  return typeof p === 'string' && p.length === 8;
}
