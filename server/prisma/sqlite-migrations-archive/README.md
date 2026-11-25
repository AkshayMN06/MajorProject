# SQLite migration history (archived)

CyberLearn ran on SQLite until the move to PostgreSQL (Supabase). These are
the 14 SQLite migrations from that period, kept for reference only — Prisma
no longer applies them. The PostgreSQL schema starts from the single
baseline in `../migrations/20261126000000_postgres_baseline`, which matches
the final state of this history (including the module-management and
analytics-uniqueness changes).

Moving data from an existing SQLite database to PostgreSQL is a one-off
import, not a migration.
