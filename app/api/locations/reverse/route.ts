import { NextResponse } from "next/server";

export const runtime = "nodejs";

type NominatimAddress = {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  postcode?: string;
};

type NominatimReversePayload = {
  display_name?: string;
  address?: NominatimAddress;
};

function normalizeText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function isValidLatitude(value: number) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value: number) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

function toAddress(payload: NominatimReversePayload) {
  const address = payload.address ?? {};
  const city =
    normalizeText(address.city) ||
    normalizeText(address.town) ||
    normalizeText(address.village) ||
    normalizeText(address.county);
  const state = normalizeText(address.state);
  const pincode = normalizeText(address.postcode);

  if (!city || !state) {
    return null;
  }

  const lineParts = [
    normalizeText(address.house_number),
    normalizeText(address.road),
    normalizeText(address.neighbourhood),
    normalizeText(address.suburb),
  ].filter((part) => part.length > 0);

  const displayLine = normalizeText(payload.display_name)
    .split(",")
    .slice(0, 2)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(", ");

  return {
    line1: lineParts.join(", ") || displayLine || `${city}, ${state}`,
    city,
    state,
    pincode,
  };
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const latitude = Number(requestUrl.searchParams.get("lat"));
    const longitude = Number(requestUrl.searchParams.get("lon"));

    if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
      return NextResponse.json(
        { error: "Latitude and longitude are invalid." },
        { status: 400 },
      );
    }

    const reverseUrl = new URL("https://nominatim.openstreetmap.org/reverse");
    reverseUrl.searchParams.set("lat", String(latitude));
    reverseUrl.searchParams.set("lon", String(longitude));
    reverseUrl.searchParams.set("format", "jsonv2");
    reverseUrl.searchParams.set("addressdetails", "1");

    const response = await fetch(reverseUrl, {
      cache: "no-store",
      headers: {
        "Accept-Language": "en",
        "User-Agent": "RentHour Location Reverse Geocoder/1.0",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to resolve this pin right now." },
        { status: 502 },
      );
    }

    const payload = (await response.json()) as NominatimReversePayload;
    const address = toAddress(payload);

    if (!address) {
      return NextResponse.json(
        { error: "Address details not found for this pin." },
        { status: 404 },
      );
    }

    return NextResponse.json(address);
  } catch {
    return NextResponse.json(
      { error: "Unable to resolve this pin right now." },
      { status: 500 },
    );
  }
}
