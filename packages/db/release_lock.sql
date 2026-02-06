-- Release Prisma advisory lock manually
-- Run this in your PostgreSQL client (psql, pgAdmin, etc.)
-- Replace 72707369 with the lock ID from the error if different

SELECT pg_advisory_unlock_all();
-- Or for a specific lock:
-- SELECT pg_advisory_unlock(72707369);