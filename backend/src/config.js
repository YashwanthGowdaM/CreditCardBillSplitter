/**
 * Central configuration. Every value comes from an environment variable so the
 * same Docker image runs anywhere (laptop, server, cloud) without code changes.
 */
export const config = {
  port: Number(process.env.PORT || 5000),

  // Master password that unlocks Add / Edit / Delete / Import in the UI.
  // It now lives ONLY on the server (it is no longer baked into the browser bundle).
  adminPassword: String(process.env.ADMIN_PASSWORD ?? 'admin123').trim(),

  // Which browser origins may call the API directly. Behind the Nginx proxy this is not needed.
  corsOrigin: process.env.CORS_ORIGIN || '*',

  db: {
    host: process.env.DB_HOST || 'database',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'cardsplit',
    password: process.env.DB_PASSWORD || 'cardsplit_secret',
    database: process.env.DB_NAME || 'cardsplit',
  },
};
