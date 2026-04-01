import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MIN_QUERY_LENGTH = 2;
const DEFAULT_MAX_RESULTS = 8;
const ABSOLUTE_MAX_RESULTS = 12;

type NominatimAddress = {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state_district?: string;
  state?: string;
  region?: string;
  country?: string;
};

type NominatimSearchItem = {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: NominatimAddress;
};

type LocationSuggestion = {
  label: string;
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  displayName: string;
};

function normalizeText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function getCity(address?: NominatimAddress) {
  if (!address) {
    return "";
  }

  return (
    normalizeText(address.city) ||
    normalizeText(address.town) ||
    normalizeText(address.village) ||
    normalizeText(address.municipality) ||
    normalizeText(address.county) ||
    normalizeText(address.state_district)
  );
}

function getState(address?: NominatimAddress) {
  if (!address) {
    return "";
  }

  return (
    normalizeText(address.state) ||
    normalizeText(address.region) ||
    normalizeText(address.state_district)
  );
}

function toSuggestion(item: NominatimSearchItem): LocationSuggestion | null {
  const latitude = Number(item.lat);
  const longitude = Number(item.lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const city = getCity(item.address);
  const state = getState(item.address);
  const country = normalizeText(item.address?.country);
  const displayName = normalizeText(item.display_name);

  if (!city && !state && !displayName) {
    return null;
  }

  const labelParts = [city, state].filter((part) => part.length > 0);
  const label = labelParts.length > 0 ? labelParts.join(", ") : displayName;

  if (!label) {
    return null;
  }

  return {
    label,
    city: city || state || label,
    state,
    country,
    latitude,
    longitude,
    displayName,
  };
}

function getLimit(rawLimit: string | null) {
  const parsed = Number(rawLimit);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_MAX_RESULTS;
  }

  return Math.max(1, Math.min(Math.trunc(parsed), ABSOLUTE_MAX_RESULTS));
}

function getCountryCodes(rawCountry: string | null) {
  const normalized = normalizeText(rawCountry).toLowerCase();
  if (!normalized) {
    return "in";
  }

  return normalized;
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const query = normalizeText(requestUrl.searchParams.get("q"));
    const countryCodes = getCountryCodes(requestUrl.searchParams.get("country"));
    const limit = getLimit(requestUrl.searchParams.get("limit"));

    if (query.length < MIN_QUERY_LENGTH) {
      return NextResponse.json({ suggestions: [] as LocationSuggestion[] });
    }

    const searchUrl = new URL("https://nominatim.openstreetmap.org/search");
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("format", "jsonv2");
    searchUrl.searchParams.set("addressdetails", "1");
    searchUrl.searchParams.set("limit", String(limit * 2));
    searchUrl.searchParams.set("countrycodes", countryCodes);

    const response = await fetch(searchUrl, {
      cache: "no-store",
      headers: {
        "Accept-Language": "en",
        "User-Agent": "RentHour Marketplace Location Search/1.0",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to fetch locations right now." },
        { status: 502 }
      );
    }

    const payload = (await response.json()) as NominatimSearchItem[];
    const suggestions: LocationSuggestion[] = [];
    const seen = new Set<string>();

    for (const entry of payload) {
      const suggestion = toSuggestion(entry);

      if (!suggestion) {
        continue;
      }

      const isCountryOnly =
        suggestion.label.toLowerCase() === suggestion.country.toLowerCase() &&
        suggestion.state.length === 0;

      if (isCountryOnly) {
        continue;
      }

      const key = `${suggestion.label.toLowerCase()}|${suggestion.latitude.toFixed(4)}|${suggestion.longitude.toFixed(4)}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      suggestions.push(suggestion);

      if (suggestions.length >= limit) {
        break;
      }
    }

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json(
      { error: "Unable to search locations right now." },
      { status: 500 }
    );
  }
}
