import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "@/store/store";

interface WishlistState {
  likedProductIds: string[];
}

const initialState: WishlistState = {
  likedProductIds: [],
};

const wishlistSlice = createSlice({
  name: "wishlist",
  initialState,
  reducers: {
    toggleWishlist(state, action: PayloadAction<string>) {
      const productId = action.payload;
      if (state.likedProductIds.includes(productId)) {
        state.likedProductIds = state.likedProductIds.filter((id) => id !== productId);
      } else {
        state.likedProductIds.push(productId);
      }
    },
    clearWishlist(state) {
      state.likedProductIds = [];
    },
  },
});

export const { toggleWishlist, clearWishlist } = wishlistSlice.actions;
export default wishlistSlice.reducer;

export const selectWishlistIds = (state: RootState) => state.wishlist.likedProductIds;
export const selectIsWishlisted = (state: RootState, productId: string) =>
  state.wishlist.likedProductIds.includes(productId);
