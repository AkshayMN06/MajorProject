import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const developmentJwtSecret = 'cyberlearn-jwt-secret-key-change-in-production';
const configuredJwtSecret = process.env.JWT_SECRET;

if (process.env.NODE_ENV === 'production' &&
    (!configuredJwtSecret?.trim() || configuredJwtSecret.trim() === developmentJwtSecret)) {
  throw new Error('A dedicated JWT_SECRET must be configured in production.');
}

// Prisma reads DATABASE_URL directly from the process environment.
// PostgreSQL connection string; required (see .env.example).
const databaseUrl = process.env.DATABASE_URL || '';
process.env.DATABASE_URL = databaseUrl;
// Migrations use DIRECT_URL (direct/session connection); fall back to the
// runtime URL where they are the same (local development, tests).
process.env.DIRECT_URL = process.env.DIRECT_URL || databaseUrl;

export function parseOrigins(value: string): (string | RegExp)[] {
  return value.split(',').map((o) => o.trim()).filter(Boolean).map((o) =>
    o.includes('*')
      ? new RegExp('^' + o.split('*').map(escapeRegExp).join('[a-z0-9-]+') + '$')
      : o
  );
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const env = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3001,
  DATABASE_URL: databaseUrl,
  JWT_SECRET: configuredJwtSecret || developmentJwtSecret,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  // Allowed browser origins, comma-separated. A `*` matches one or more
  // letters, digits or hyphens — e.g. every preview of one Vercel project:
  // https://cyberlearn-web-*-major-project-5fef.vercel.app
  CORS_ORIGIN: parseOrigins(process.env.CORS_ORIGIN || 'http://localhost:5173'),
  // Shared Socket.IO state across server instances (Vercel): a PostgreSQL
  // connection that supports LISTEN/NOTIFY (Supabase session pooler or direct).
  // Unset locally, where one process holds every connection.
  SOCKET_ADAPTER_URL: process.env.SOCKET_ADAPTER_URL || '',
  CLIENT_APP_URL: process.env.CLIENT_APP_URL || 'http://localhost:5173',
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || 'CyberLearn <no-reply@cyberlearn.local>',
  // Private storage for uploaded module materials. Must not be inside any
  // statically served directory; files are only served by the authorized
  // download routes.
  MODULE_FILE_DIR: path.resolve(process.env.MODULE_FILE_DIR || path.join(process.cwd(), 'storage', 'module-files')),
  MODULE_FILE_MAX_MB: process.env.MODULE_FILE_MAX_MB ? Number(process.env.MODULE_FILE_MAX_MB) : 15,
  // Whole-request budget for one upload (all files together), checked from
  // Content-Length before any bytes are buffered.
  MODULE_UPLOAD_MAX_TOTAL_MB: process.env.MODULE_UPLOAD_MAX_TOTAL_MB ? Number(process.env.MODULE_UPLOAD_MAX_TOTAL_MB) : 40,
  // Per-file text extraction deadline; the extraction process is killed at it.
  MODULE_EXTRACT_TIMEOUT_MS: process.env.MODULE_EXTRACT_TIMEOUT_MS ? Number(process.env.MODULE_EXTRACT_TIMEOUT_MS) : 20_000,
  // Supabase Storage for module originals (required on Vercel). Server-side
  // only: the service-role key must never reach the client.
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  MODULE_FILE_BUCKET: process.env.MODULE_FILE_BUCKET || 'module-files',
};
