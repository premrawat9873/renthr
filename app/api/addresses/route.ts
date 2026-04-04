import { NextResponse } from "next/server";

import {
  isValidPincode,
  normalizePincode,
  normalizeText,
  resolveAuthenticatedUserId,
  toAddressPayload,
} from "@/lib/address-utils";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type CreateAddressBody = {
  address?: unknown;
  state?: unknown;
  city?: unknown;
  pincode?: unknown;
};

const ADDRESS_MIN_LENGTH = 5;
const LOCATION_MIN_LENGTH = 2;

const addressSelect = {
  id: true,
  line1: true,
  state: true,
  city: true,
  pincode: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function GET() {
  try {
    const userId = await resolveAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Please log in to view addresses." },
        { status: 401 }
      );
    }

    const addresses = await prisma.address.findMany({
      where: {
        userId,
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: addressSelect,
    });

    return NextResponse.json({
      addresses: addresses.map(toAddressPayload),
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to fetch addresses right now." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await resolveAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Please log in before adding an address." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as CreateAddressBody;
    const addressLine1 = normalizeText(body.address);
    const state = normalizeText(body.state);
    const city = normalizeText(body.city);
    const pincode = normalizePincode(body.pincode);

    if (addressLine1.length < ADDRESS_MIN_LENGTH) {
      return NextResponse.json(
        { error: "Address must be at least 5 characters." },
        { status: 400 }
      );
    }

    if (state.length < LOCATION_MIN_LENGTH) {
      return NextResponse.json(
        { error: "State must be at least 2 characters." },
        { status: 400 }
      );
    }

    if (city.length < LOCATION_MIN_LENGTH) {
      return NextResponse.json(
        { error: "City must be at least 2 characters." },
        { status: 400 }
      );
    }

    if (!isValidPincode(pincode)) {
      return NextResponse.json(
        { error: "Enter a valid 6-digit pincode." },
        { status: 400 }
      );
    }

    const createdAddress = await prisma.address.create({
      data: {
        userId,
        line1: addressLine1,
        state,
        city,
        pincode,
      },
      select: addressSelect,
    });

    return NextResponse.json(
      {
        address: toAddressPayload(createdAddress),
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to save address right now." },
      { status: 500 }
    );
  }
}
