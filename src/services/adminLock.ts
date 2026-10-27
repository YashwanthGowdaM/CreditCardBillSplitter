/**
 * Admin Lock Service
 * Master admin password is read strictly from VITE_ADMIN_PASSWORD in .env.
 * Defaults to 'admin123' if VITE_ADMIN_PASSWORD is not specified.
 */

export function getAdminPassword(): string {
  const envPassword = (import.meta as any).env?.VITE_ADMIN_PASSWORD;
  if (typeof envPassword === 'string' && envPassword.trim().length > 0) {
    return envPassword.trim();
  }
  return 'admin123';
}

export function verifyAdminPassword(input: string): boolean {
  const currentPassword = getAdminPassword();
  return input.trim() === currentPassword;
}
