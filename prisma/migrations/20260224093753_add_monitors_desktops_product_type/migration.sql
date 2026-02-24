-- AlterTable
ALTER TABLE "email_stats" ADD COLUMN     "productType" TEXT;

-- CreateTable
CREATE TABLE "watched_monitors" (
    "id" TEXT NOT NULL,
    "sizeInchesMin" DOUBLE PRECISION,
    "sizeInchesMax" DOUBLE PRECISION,
    "resolutionMin" TEXT,
    "resolutionMax" TEXT,
    "maxPrice" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "watched_monitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watched_desktops" (
    "id" TEXT NOT NULL,
    "caseType" TEXT NOT NULL,
    "maxPrice" TEXT,
    "ramFrom" TEXT,
    "ramTo" TEXT,
    "storageFrom" TEXT,
    "storageTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "watched_desktops_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_stats_productType_idx" ON "email_stats"("productType");
