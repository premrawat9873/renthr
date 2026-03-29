-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('SELL', 'RENT');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "ageUnit" TEXT,
ADD COLUMN     "ageValue" DOUBLE PRECISION,
ADD COLUMN     "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'electronics',
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "image" TEXT,
ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "listingType" "ListingType",
ADD COLUMN     "location" TEXT NOT NULL DEFAULT 'Bangalore',
ADD COLUMN     "rating" DOUBLE PRECISION,
ADD COLUMN     "rentDaily" INTEGER,
ADD COLUMN     "rentHourly" INTEGER,
ADD COLUMN     "rentMonthly" INTEGER,
ADD COLUMN     "rentWeekly" INTEGER,
ADD COLUMN     "reviewCount" INTEGER,
ADD COLUMN     "sellPrice" INTEGER,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Post_listingType_createdAt_idx" ON "Post"("listingType", "createdAt");
