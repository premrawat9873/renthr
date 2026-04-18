-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER','ADMIN');

-- Add role column to users
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';

-- Backfill admin users by email
UPDATE "User" SET "role" = 'ADMIN' WHERE LOWER("email") IN ('premrawat9873@gmail.com','renthour9873@gmail.com');
