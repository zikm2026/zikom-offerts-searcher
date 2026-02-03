-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_key_key" ON "app_settings"("key");

-- Insert default global match threshold (replacing per-laptop threshold)
INSERT INTO "app_settings" ("id", "key", "value") VALUES (gen_random_uuid(), 'matchThreshold', '90');

-- AlterTable
ALTER TABLE "watched_laptops" DROP COLUMN IF EXISTS "matchThreshold";
