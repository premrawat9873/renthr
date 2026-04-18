-- Create Report table if not exists (keeps parity with existing raw-SQL helper)
CREATE TABLE IF NOT EXISTS "Report" (
  "id" SERIAL PRIMARY KEY,
  "reporterId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "targetType" VARCHAR(16) NOT NULL,
  "targetId" INTEGER NOT NULL,
  "reason" VARCHAR(120) NOT NULL,
  "details" TEXT,
  "status" VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Report_targetType_check" CHECK ("targetType" IN ('post', 'user'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "Report_unique_reporter_target_idx"
  ON "Report" ("reporterId", "targetType", "targetId");

CREATE INDEX IF NOT EXISTS "Report_target_idx"
  ON "Report" ("targetType", "targetId");

CREATE INDEX IF NOT EXISTS "Report_createdAt_idx"
  ON "Report" ("createdAt");
