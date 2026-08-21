-- Add role to users, default 'USER' so all existing rows backfill safely.
ALTER TABLE "users" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'USER';
