import "server-only";

import { prisma } from "@/lib/prisma";

export type ReportTargetType = "post" | "user";

type SubmitReportInput = {
  reporterId: number;
  targetType: ReportTargetType;
  targetId: number;
  reason: string;
  details?: string;
};

let reportTableEnsured = false;

function normalizeReason(value: string) {
  return value.trim().slice(0, 120);
}

function normalizeDetails(value: string | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, 2000);
}

async function ensureReportTable() {
  if (reportTableEnsured) {
    return;
  }

  await prisma.$executeRawUnsafe(`
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
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Report_unique_reporter_target_idx"
      ON "Report" ("reporterId", "targetType", "targetId");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Report_target_idx"
      ON "Report" ("targetType", "targetId");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Report_createdAt_idx"
      ON "Report" ("createdAt");
  `);

  reportTableEnsured = true;
}

export async function submitReport(input: SubmitReportInput) {
  const reason = normalizeReason(input.reason);
  if (!reason) {
    throw new Error("Reason is required.");
  }

  const details = normalizeDetails(input.details);

  if (input.targetType === "post") {
    const post = await prisma.post.findUnique({
      where: { id: input.targetId },
      select: { id: true, authorId: true },
    });

    if (!post) {
      throw new Error("Listing not found.");
    }

    if (post.authorId === input.reporterId) {
      throw new Error("You cannot report your own listing.");
    }
  }

  if (input.targetType === "user") {
    const user = await prisma.user.findUnique({
      where: { id: input.targetId },
      select: { id: true },
    });

    if (!user) {
      throw new Error("User not found.");
    }

    if (user.id === input.reporterId) {
      throw new Error("You cannot report your own account.");
    }
  }

  await ensureReportTable();

  await prisma.$executeRaw`
    INSERT INTO "Report" (
      "reporterId",
      "targetType",
      "targetId",
      "reason",
      "details",
      "status",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${input.reporterId},
      ${input.targetType},
      ${input.targetId},
      ${reason},
      ${details},
      'OPEN',
      NOW(),
      NOW()
    )
    ON CONFLICT ("reporterId", "targetType", "targetId")
    DO UPDATE SET
      "reason" = EXCLUDED."reason",
      "details" = EXCLUDED."details",
      "status" = 'OPEN',
      "updatedAt" = NOW();
  `;
}
