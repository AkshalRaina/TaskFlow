-- Team projects (members + roles), task assignees, and task history.
-- Hand-edited from Prisma's generated SQL so that EXISTING data is kept:
-- the old projects.user_id becomes created_by_id, that user becomes the project's ADMIN,
-- and existing tasks are credited to the project's creator.

-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('CREATED', 'UPDATED');

-- Projects: rename user_id -> created_by_id (keeps the data, unlike drop + add)
ALTER TABLE "projects" DROP CONSTRAINT "projects_user_id_fkey";
DROP INDEX "projects_user_id_created_at_idx";
ALTER TABLE "projects" RENAME COLUMN "user_id" TO "created_by_id";

-- CreateTable
CREATE TABLE "project_members" (
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "ProjectRole" NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("project_id","user_id")
);

-- Backfill: every existing project's creator becomes its ADMIN.
INSERT INTO "project_members" ("project_id", "user_id", "role", "joined_at")
SELECT "id", "created_by_id", 'ADMIN', "created_at" FROM "projects";

-- Tasks: add assignee (optional) and creator (backfilled from the project's creator, then made required)
ALTER TABLE "tasks" ADD COLUMN "assignee_id" TEXT,
ADD COLUMN "created_by_id" TEXT;

UPDATE "tasks" t SET "created_by_id" = p."created_by_id"
FROM "projects" p WHERE p."id" = t."project_id";

ALTER TABLE "tasks" ALTER COLUMN "created_by_id" SET NOT NULL;

-- CreateTable
CREATE TABLE "task_activities" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" "ActivityAction" NOT NULL,
    "changes" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_activities_pkey" PRIMARY KEY ("id")
);

-- Backfill: give every existing task a "created" entry in its history.
INSERT INTO "task_activities" ("id", "task_id", "actor_id", "action", "created_at")
SELECT gen_random_uuid()::text, "id", "created_by_id", 'CREATED', "created_at" FROM "tasks";

-- CreateIndex
CREATE INDEX "project_members_user_id_idx" ON "project_members"("user_id");

-- CreateIndex
CREATE INDEX "task_activities_task_id_created_at_idx" ON "task_activities"("task_id", "created_at");

-- CreateIndex
CREATE INDEX "tasks_assignee_id_idx" ON "tasks"("assignee_id");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_activities" ADD CONSTRAINT "task_activities_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_activities" ADD CONSTRAINT "task_activities_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
