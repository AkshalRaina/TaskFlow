-- Adds the OWNER role (the person who created the project).
-- Kept in its own migration: Postgres can't use a new enum value in the same transaction that adds it.
ALTER TYPE "ProjectRole" ADD VALUE 'OWNER' BEFORE 'ADMIN';
