import { NextResponse } from "next/server";

export const runtime = "nodejs";

const INDIA_COUNTRY = "India";
const STATES_ENDPOINT = "https://countriesnow.space/api/v0.1/countries/states";
const CITIES_ENDPOINT = "https://countriesnow.space/api/v0.1/countries/state/cities";
const STATE_CACHE_TTL_MS = 1000 * 60 * 60 * 12;

type StateOption = {
  name: string;
  isoCode: string;
};

type CountriesNowStatesResponse = {
  error?: boolean;
  data?: {
    states?: Array<{
      name?: string;
      state_code?: string;
    }>;
  };
};

type CountriesNowCitiesResponse = {
  error?: boolean;
  data?: string[];
};

let cachedStates: StateOption[] | null = null;
let cachedStatesAt = 0;

function normalizeText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

async function getStateOptions() {
  const now = Date.now();
  if (cachedStates && now - cachedStatesAt < STATE_CACHE_TTL_MS) {
    return cachedStates;
  }

  const response = await fetch(STATES_ENDPOINT, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      country: INDIA_COUNTRY,
    }),
  });

  if (!response.ok) {
    throw new Error("State list provider is currently unavailable.");
  }

  const payload = (await response.json()) as CountriesNowStatesResponse;
  if (payload.error || !Array.isArray(payload.data?.states)) {
    throw new Error("State list could not be loaded.");
  }

  const options: StateOption[] = [];
  for (const state of payload.data.states) {
    const name = normalizeText(state.name);
    const isoCode = normalizeText(state.state_code).toUpperCase() || name;

    if (!name) {
      continue;
    }

    options.push({ name, isoCode });
  }

  const uniqueOptions = Array.from(
    new Map(options.map((option) => [option.name.toLowerCase(), option])).values(),
  ).sort((a, b) => a.name.localeCompare(b.name, "en"));

  cachedStates = uniqueOptions;
  cachedStatesAt = now;
  return uniqueOptions;
}

async function getCityOptions(stateRef: string) {
  const states = await getStateOptions();
  const matchedState = states.find(
    (state) =>
      state.isoCode.toLowerCase() === stateRef.toLowerCase() ||
      state.name.toLowerCase() === stateRef.toLowerCase(),
  );
  const stateName = matchedState?.name ?? stateRef;

  const response = await fetch(CITIES_ENDPOINT, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      country: INDIA_COUNTRY,
      state: stateName,
    }),
  });

  if (!response.ok) {
    throw new Error("City list provider is currently unavailable.");
  }

  const payload = (await response.json()) as CountriesNowCitiesResponse;
  if (payload.error || !Array.isArray(payload.data)) {
    throw new Error("City list could not be loaded.");
  }

  const cityNames = new Set<string>();
  for (const city of payload.data) {
    const name = normalizeText(city);
    if (!name) {
      continue;
    }

    cityNames.add(name);
  }

  return Array.from(cityNames).sort((a, b) => a.localeCompare(b, "en"));
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const stateCode = normalizeText(requestUrl.searchParams.get("state")).toUpperCase();

    if (stateCode) {
      return NextResponse.json({
        cities: await getCityOptions(stateCode),
      });
    }

    return NextResponse.json({
      states: await getStateOptions(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load location options right now.",
      },
      { status: 500 },
    );
  }
}
