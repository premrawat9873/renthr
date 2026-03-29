import { NextResponse } from "next/server";

import {
  isValidPincode,
  normalizePincode,
  normalizeText,
  parseAddressId,
  resolveAuthenticatedUserId,
  toAddressPayload,
} from "@/lib/address-utils";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type AddressRouteParams = {
  id: string;
};

type UpdateAddressBody = {
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<AddressRouteParams> }
) {
  try {
    const userId = await resolveAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Please log in before updating an address." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const addressId = parseAddressId(id);

    if (!addressId) {
      return NextResponse.json(
        { error: "Address ID is invalid." },
        { status: 400 }
      );
    }

    const body = (await request.json()) as UpdateAddressBody;
    const updates: Partial<{
      address: string;
      state: string;
      city: string;
      pincode: string;
    }> = {};

    if (Object.prototype.hasOwnProperty.call(body, "address")) {
      const normalizedAddress = normalizeText(body.address);
      if (normalizedAddress.length < ADDRESS_MIN_LENGTH) {
        return NextResponse.json(
          { error: "Address must be at least 5 characters." },
          { status: 400 }
        );
      }
      updates.address = normalizedAddress;
    }

    if (Object.prototype.hasOwnProperty.call(body, "state")) {
      const normalizedState = normalizeText(body.state);
      if (normalizedState.length < LOCATION_MIN_LENGTH) {
        return NextResponse.json(
          { error: "State must be at least 2 characters." },
          { status: 400 }
        );
      }
      updates.state = normalizedState;
    }

    if (Object.prototype.hasOwnProperty.call(body, "city")) {
      const normalizedCity = normalizeText(body.city);
      if (normalizedCity.length < LOCATION_MIN_LENGTH) {
        return NextResponse.json(
          { error: "City must be at least 2 characters." },
          { status: 400 }
        );
      }
      updates.city = normalizedCity;
    }

    if (Object.prototype.hasOwnProperty.call(body, "pincode")) {
      const normalizedPincode = normalizePincode(body.pincode);
      if (!isValidPincode(normalizedPincode)) {
        return NextResponse.json(
          {
            error:
              "Enter a valid pincode (4-12 letters, numbers, spaces, or hyphen).",
          },
          { status: 400 }
        );
      }
      updates.pincode = normalizedPincode;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Provide at least one field to update." },
        { status: 400 }
      );
    }

    const existingAddress = await prisma.address.findFirst({
      where: {
        id: addressId,
        userId,
      },
      select: {
        id: true,
      },
    });

    if (!existingAddress) {
      return NextResponse.json(
        { error: "Address not found." },
        { status: 404 }
      );
    }

    const updatedAddress = await prisma.address.update({
      where: {
        id: addressId,
      },
      data: updates,
      select: addressSelect,
    });

    return NextResponse.json({
      address: toAddressPayload(updatedAddress),
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to update address right now." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<AddressRouteParams> }
) {
  try {
    const userId = await resolveAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Please log in before deleting an address." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const addressId = parseAddressId(id);

    if (!addressId) {
      return NextResponse.json(
        { error: "Address ID is invalid." },
        { status: 400 }
      );
    }

    const deleted = await prisma.address.deleteMany({
      where: {
        id: addressId,
        userId,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { error: "Address not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to delete address right now." },
      { status: 500 }
    );
  }
}
