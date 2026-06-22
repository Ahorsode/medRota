export function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters long.";
  }
  if (/^\d+$/.test(password)) {
    return "Choose a password that isn't only numbers. Your staff number is not secure enough.";
  }
  return null;
}
