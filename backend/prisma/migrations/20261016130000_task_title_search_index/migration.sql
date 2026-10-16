-- Trigram index so task search (title ILIKE '%term%') uses an index instead of scanning every task.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX "tasks_title_idx" ON "tasks" USING GIN ("title" gin_trgm_ops);
