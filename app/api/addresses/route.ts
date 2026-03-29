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
  address: true,
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
    const address = normalizeText(body.address);
    const state = normalizeText(body.state);
    const city = normalizeText(body.city);
    const pincode = normalizePincode(body.pincode);

    if (address.length < ADDRESS_MIN_LENGTH) {
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
        { error: "Enter a valid pincode (4-12 letters, numbers, spaces, or hyphen)." },
        { status: 400 }
      );
    }

    const createdAddress = await prisma.address.create({
      data: {
        userId,
        address,
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
