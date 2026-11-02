export const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
export const validPassword = (value: string) => value.length >= 8;
// Loose E.164: optional leading +, 8-15 digits total, no leading zero. Matches the backend's own
// PHONE_PATTERN in update-profile.dto.ts — keep the two in step. Phone is optional everywhere it
// appears, so an empty string is valid (nothing to check) and callers decide what empty means.
export const validPhone = (value: string) =>
  value.trim() === '' || /^\+?[1-9]\d{7,14}$/.test(value.trim());
export type SignUpValues = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};
export function validateSignUp(v: SignUpValues) {
  const errors: Partial<Record<keyof SignUpValues, string>> = {};
  if (v.name.trim().length < 2) errors.name = 'Enter your full name.';
  if (!validEmail(v.email)) errors.email = 'Enter a valid email address.';
  if (!validPassword(v.password)) errors.password = 'Use at least 8 characters.';
  if (v.confirmPassword !== v.password) errors.confirmPassword = 'Passwords must match.';
  return errors;
}
