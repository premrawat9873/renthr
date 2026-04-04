import "server-only";

import { getCurrentUserInfo } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

const PINCODE_PATTERN = /^\d{6}$/;

type AddressRecord = {
  id: number;
  line1: string;
  state: string;
  city: string;
  pincode: string;
  createdAt: Date;
  updatedAt: Date;
};

function parsePositiveInt(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function parseAddressId(id: string) {
  return parsePositiveInt(id);
}

export function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizePincode(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function isValidPincode(value: string) {
  return PINCODE_PATTERN.test(value);
}

export function toAddressPayload(address: AddressRecord) {
  return {
    id: String(address.id),
    address: address.line1,
    state: address.state,
    city: address.city,
    pincode: address.pincode,
    createdAt: address.createdAt.toISOString(),
    updatedAt: address.updatedAt.toISOString(),
  };
}

export async function resolveAuthenticatedUserId() {
  const currentUser = await getCurrentUserInfo();
  if (!currentUser) {
    return null;
  }

  const parsedUserId = parsePositiveInt(currentUser.id);
  if (parsedUserId) {
    return parsedUserId;
  }

  const normalizedEmail = currentUser.email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return null;
  }

  const user = await prisma.user.upsert({
    where: {
      email: normalizedEmail,
    },
    update: {
      ...(currentUser.name
        ? {
            name: currentUser.name,
          }
        : {}),
      ...(currentUser.avatarUrl
        ? {
            avatarUrl: currentUser.avatarUrl,
          }
        : {}),
    },
    create: {
      email: normalizedEmail,
      name: currentUser.name,
      avatarUrl: currentUser.avatarUrl,
    },
    select: {
      id: true,
    },
  });

  return user.id;
}
