import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
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

const initialState: MarketplaceState = {
  location: null,
  userLocation: null,
  userCoords: null,
  searchQuery: "",
  selectedCategory: null,
  filter: "all",
  rentDurations: [],
  sort: "newest",
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
      state.rentDurations = action.payload;
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
export const selectSearchQuery = (state: RootState) => state.marketplace.searchQuery;
export const selectSelectedCategory = (state: RootState) => state.marketplace.selectedCategory;
export const selectListingFilter = (state: RootState) => state.marketplace.filter;
export const selectRentDurations = (state: RootState) => state.marketplace.rentDurations;
export const selectSort = (state: RootState) => state.marketplace.sort;
export const selectPriceRange = (state: RootState) => state.marketplace.priceRange;
export const selectHasActiveFilters = (state: RootState) => {
  const marketplace = state.marketplace;
  return (
    marketplace.filter !== "all" ||
    marketplace.selectedCategory !== null ||
    marketplace.rentDurations.length > 0 ||
    marketplace.searchQuery !== "" ||
    marketplace.priceRange[0] > 0 ||
    marketplace.priceRange[1] < MAX_PRICE
  );
};
