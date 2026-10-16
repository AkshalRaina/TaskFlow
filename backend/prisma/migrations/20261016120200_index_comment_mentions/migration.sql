-- CreateIndex
CREATE INDEX "task_comments_mentioned_user_ids_idx" ON "task_comments" USING GIN ("mentioned_user_ids");
