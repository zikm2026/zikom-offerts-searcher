-- CreateTable
CREATE TABLE "watched_laptops" (
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "maxPriceWorst" TEXT,
    "maxPriceBest" TEXT,
    "ramFrom" TEXT,
    "ramTo" TEXT,
    "storageFrom" TEXT,
    "storageTo" TEXT,
    "gradeFrom" TEXT,
    "gradeTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "watched_laptops_pkey" PRIMARY KEY ("id")
);
