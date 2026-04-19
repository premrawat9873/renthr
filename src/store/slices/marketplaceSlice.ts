import { createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ListingFilter, RentDuration, SortOption } from "@/data/marketplaceData";
import type { RootState } from "@/store/store";

export interface UserLocation {
  city: string;
  state: string;
  latitude: number;
  longitude: number;
}

export interface UserCoords {
  latitude: number;
  longitude: number;
}

export interface MarketplaceState {
  location: string | null;
  userLocation: UserLocation | null;
  userCoords: UserCoords | null;
  searchQuery: string;
  selectedCategories: string[];
  filter: ListingFilter;
  rentDurations: RentDuration[];
  sort: SortOption;
  priceRange: [number, number];
}

export const MAX_PRICE = 200000;

const VALID_FILTERS: ListingFilter[] = ["all", "rent", "sell"];
const VALID_SORT_OPTIONS: SortOption[] = [
  "newest",
  "price-asc",
  "price-desc",
  "distance",
];
const VALID_RENT_DURATIONS: RentDuration[] = [
  "hourly",
  "daily",
  "weekly",
  "monthly",
];

function normalizeRentDurations(value: unknown): RentDuration[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value.filter((duration): duration is RentDuration =>
    VALID_RENT_DURATIONS.includes(duration as RentDuration)
  );

  return Array.from(new Set(normalized));
}

function normalizeListingFilter(value: unknown): ListingFilter {
  return VALID_FILTERS.includes(value as ListingFilter)
    ? (value as ListingFilter)
    : "all";
}

function normalizeSortOption(value: unknown): SortOption {
  return VALID_SORT_OPTIONS.includes(value as SortOption)
    ? (value as SortOption)
    : "distance";
}

function normalizePriceRange(value: unknown): [number, number] {
  if (!Array.isArray(value) || value.length !== 2) {
    return [0, MAX_PRICE];
  }

  const rawMin = Number(value[0]);
  const rawMax = Number(value[1]);
  const min = Number.isFinite(rawMin) ? Math.max(0, Math.floor(rawMin)) : 0;
  const max = Number.isFinite(rawMax)
    ? Math.min(MAX_PRICE, Math.floor(rawMax))
    : MAX_PRICE;

  if (max < min) {
    return [min, min];
  }

  return [min, max];
}

function normalizeSelectedCategories(value: unknown): string[] {
  if (Array.isArray(value)) {
    const normalized = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    return Array.from(new Set(normalized));
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized ? [normalized] : [];
  }

  return [];
}

const initialState: MarketplaceState = {
  location: null,
  userLocation: null,
  userCoords: null,
  searchQuery: "",
  selectedCategories: [],
  filter: "all",
  rentDurations: [],
  sort: "distance",
  priceRange: [0, MAX_PRICE],
};

const marketplaceSlice = createSlice({
  name: "marketplace",
  initialState,
  reducers: {
    setLocation(state, action: PayloadAction<string | null>) {
      state.location = action.payload;
    },
    setUserLocation(state, action: PayloadAction<UserLocation | null>) {
      state.userLocation = action.payload;
    },
    setUserCoords(state, action: PayloadAction<UserCoords | null>) {
      state.userCoords = action.payload;
    },
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    setSelectedCategories(state, action: PayloadAction<string[]>) {
      state.selectedCategories = normalizeSelectedCategories(action.payload);
    },
    setFilter(state, action: PayloadAction<ListingFilter>) {
      state.filter = action.payload;
    },
    toggleRentDuration(state, action: PayloadAction<RentDuration>) {
      const duration = action.payload;
      if (state.rentDurations.includes(duration)) {
        state.rentDurations = state.rentDurations.filter((item) => item !== duration);
      } else {
        state.rentDurations = [...state.rentDurations, duration];
      }
    },
    setRentDurations(state, action: PayloadAction<RentDuration[]>) {
      state.rentDurations = normalizeRentDurations(action.payload);
    },
    setSort(state, action: PayloadAction<SortOption>) {
      state.sort = action.payload;
    },
    setPriceRange(state, action: PayloadAction<[number, number]>) {
      state.priceRange = action.payload;
    },
    clearFilters(state) {
      state.searchQuery = "";
      state.selectedCategories = [];
      state.filter = "all";
      state.rentDurations = [];
      state.priceRange = [0, MAX_PRICE];
    },
    resetMarketplaceState() {
      return initialState;
    },
  },
});

export const {
  setLocation,
  setUserLocation,
  setUserCoords,
  setSearchQuery,
  setSelectedCategories,
  setFilter,
  toggleRentDuration,
  setRentDurations,
  setSort,
  setPriceRange,
  clearFilters,
  resetMarketplaceState,
} = marketplaceSlice.actions;

export default marketplaceSlice.reducer;

export const selectMarketplaceState = (state: RootState) => state.marketplace;
export const selectLocation = (state: RootState) => state.marketplace.location;
export const selectUserLocation = (state: RootState) => state.marketplace.userLocation;
export const selectUserCoords = (state: RootState) => state.marketplace.userCoords;
export const selectSearchQuery = (state: RootState) => state.marketplace.searchQuery ?? "";
const selectRawSelectedCategories = (state: RootState): unknown => {
  const marketplaceState = state.marketplace as unknown as Record<string, unknown>;

  if (
    Array.isArray(marketplaceState.selectedCategories) ||
    typeof marketplaceState.selectedCategories === "string"
  ) {
    return marketplaceState.selectedCategories;
  }

  return marketplaceState.selectedCategory;
};

export const selectSelectedCategories = createSelector(
  [selectRawSelectedCategories],
  (selectedCategories) => normalizeSelectedCategories(selectedCategories)
);

const selectRawFilter = (state: RootState) => state.marketplace.filter;
const selectRawRentDurations = (state: RootState) => state.marketplace.rentDurations;
const selectRawSort = (state: RootState) => state.marketplace.sort;
const selectRawPriceRange = (state: RootState) => state.marketplace.priceRange;

export const selectListingFilter = createSelector([selectRawFilter], (filter) =>
  normalizeListingFilter(filter)
);
export const selectRentDurations = createSelector(
  [selectRawRentDurations],
  (rentDurations) => normalizeRentDurations(rentDurations)
);
export const selectSort = createSelector([selectRawSort], (sort) => normalizeSortOption(sort));
export const selectPriceRange = createSelector([selectRawPriceRange], (priceRange) =>
  normalizePriceRange(priceRange)
);
export const selectHasActiveFilters = createSelector(
  [
    selectListingFilter,
    selectSelectedCategories,
    selectRentDurations,
    selectSearchQuery,
    selectPriceRange,
  ],
  (filter, selectedCategories, rentDurations, searchQuery, priceRange) => {
    return (
      filter !== "all" ||
      selectedCategories.length > 0 ||
      rentDurations.length > 0 ||
      searchQuery !== "" ||
      priceRange[0] > 0 ||
      priceRange[1] < MAX_PRICE
    );
  }
);
