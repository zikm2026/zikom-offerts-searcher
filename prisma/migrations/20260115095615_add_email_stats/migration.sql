-- CreateTable
CREATE TABLE "email_stats" (
    "id" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "subject" TEXT,
    "from" TEXT,

    CONSTRAINT "email_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_stats_processedAt_idx" ON "email_stats"("processedAt");

-- CreateIndex
CREATE INDEX "email_stats_status_idx" ON "email_stats"("status");
