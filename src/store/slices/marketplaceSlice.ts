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
  selectedCategory: string | null;
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

const initialState: MarketplaceState = {
  location: null,
  userLocation: null,
  userCoords: null,
  searchQuery: "",
  selectedCategory: null,
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
    setSelectedCategory(state, action: PayloadAction<string | null>) {
      state.selectedCategory = action.payload;
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
      state.selectedCategory = null;
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
  setSelectedCategory,
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
export const selectSelectedCategory = (state: RootState) =>
  state.marketplace.selectedCategory ?? null;

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
    selectSelectedCategory,
    selectRentDurations,
    selectSearchQuery,
    selectPriceRange,
  ],
  (filter, selectedCategory, rentDurations, searchQuery, priceRange) => {
    return (
      filter !== "all" ||
      selectedCategory !== null ||
      rentDurations.length > 0 ||
      searchQuery !== "" ||
      priceRange[0] > 0 ||
      priceRange[1] < MAX_PRICE
    );
  }
);
