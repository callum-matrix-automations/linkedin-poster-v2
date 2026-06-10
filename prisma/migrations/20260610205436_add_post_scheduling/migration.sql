-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "failed_reason" TEXT,
ADD COLUMN     "linkedin_url" TEXT,
ADD COLUMN     "scheduled_for" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "posts_status_scheduled_for_idx" ON "posts"("status", "scheduled_for");
