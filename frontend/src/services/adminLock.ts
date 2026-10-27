/**
 * Admin Lock Service
 * The master password is now verified by the BACKEND service (ADMIN_PASSWORD in .env).
 * It is no longer compiled into the browser bundle. After a successful check the
 * password is kept in memory so the backend can authorize write requests.
 */
import { api, ApiError, setAdminPassword } from './api';

/** Returns true if the password is correct. Throws for network / rate-limit problems. */
export async function verifyAdminPassword(input: string): Promise<boolean> {
  const password = input.trim();
  try {
    await api.post('/admin/verify', { password });
    setAdminPassword(password);
    return true;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return false;
    throw err;
  }
}

/** Called when the user locks the app again. */
export function clearAdminSession(): void {
  setAdminPassword(null);
}
