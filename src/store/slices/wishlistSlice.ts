import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "@/store/store";

interface WishlistState {
  likedProductIds: string[];
  pendingIds: string[];
  initialized: boolean;
  lastError: string | null;
}

const initialState: WishlistState = {
  likedProductIds: [],
  pendingIds: [],
  initialized: false,
  lastError: null,
};

function ensureStateIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return dedupeIds(value.map((entry) => String(entry)));
}

function getPendingIds(state: WishlistState) {
  const normalized = ensureStateIds(state.pendingIds);
  state.pendingIds = normalized;
  return normalized;
}

function getLikedProductIds(state: WishlistState) {
  const normalized = ensureStateIds(state.likedProductIds);
  state.likedProductIds = normalized;
  return normalized;
}

function dedupeIds(ids: string[]) {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

export const fetchWishlist = createAsyncThunk<
  string[],
  void,
  { rejectValue: string }
>("wishlist/fetch", async (_, { rejectWithValue }) => {
  const response = await fetch("/api/wishlist", { cache: "no-store" });

  const payload = (await response.json().catch(() => null)) as
    | { ids?: unknown; error?: unknown }
    | null;

  if (response.status === 401) {
    return [];
  }

  if (!response.ok) {
    const message =
      (typeof payload?.error === "string" && payload.error) ||
      "Could not load wishlist.";
    return rejectWithValue(message);
  }

  const ids = Array.isArray(payload?.ids)
    ? payload.ids.map((value) => String(value))
    : [];

  return dedupeIds(ids);
});

export const toggleWishlistOnServer = createAsyncThunk<
  { productId: string; liked: boolean },
  { productId: string; like: boolean },
  { rejectValue: { productId: string; message: string } }
>("wishlist/toggle", async ({ productId, like }, { rejectWithValue }) => {
  const response = await fetch(
    `/api/wishlist/${encodeURIComponent(productId)}`,
    {
      method: like ? "POST" : "DELETE",
    }
  );

  const payload = (await response.json().catch(() => null)) as
    | { liked?: unknown; error?: unknown }
    | null;

  if (response.status === 401) {
    return rejectWithValue({
      productId,
      message: "Please log in to use wishlist.",
    });
  }

  if (!response.ok) {
    return rejectWithValue({
      productId,
      message:
        (typeof payload?.error === "string" && payload.error) ||
        "Unable to update wishlist right now.",
    });
  }

  const liked =
    typeof payload?.liked === "boolean" ? payload.liked : Boolean(like);

  return { productId, liked };
});

const wishlistSlice = createSlice({
  name: "wishlist",
  initialState,
  reducers: {
    setWishlist(state, action: PayloadAction<string[]>) {
      state.likedProductIds = dedupeIds(action.payload);
      state.pendingIds = getPendingIds(state);
      state.initialized = true;
      state.lastError = null;
    },
    resetWishlistState(state) {
      state.likedProductIds = [];
      state.pendingIds = [];
      state.initialized = false;
      state.lastError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWishlist.fulfilled, (state, action) => {
        state.likedProductIds = dedupeIds(action.payload);
        state.pendingIds = getPendingIds(state);
        state.initialized = true;
        state.lastError = null;
      })
      .addCase(fetchWishlist.rejected, (state, action) => {
        state.pendingIds = getPendingIds(state);
        state.likedProductIds = getLikedProductIds(state);
        state.initialized = true;
        state.lastError = action.payload ?? action.error.message ?? null;
      })
      .addCase(toggleWishlistOnServer.pending, (state, action) => {
        const targetId = action.meta.arg.productId;
        const pendingIds = getPendingIds(state);
        if (!pendingIds.includes(targetId)) {
          pendingIds.push(targetId);
        }
      })
      .addCase(toggleWishlistOnServer.fulfilled, (state, action) => {
        const { productId, liked } = action.payload;
        const pendingIds = getPendingIds(state);
        state.pendingIds = pendingIds.filter((id) => id !== productId);
        state.initialized = true;
        state.lastError = null;

        const likedProductIds = getLikedProductIds(state);
        if (liked) {
          if (!likedProductIds.includes(productId)) {
            likedProductIds.push(productId);
          }
        } else {
          state.likedProductIds = likedProductIds.filter(
            (id) => id !== productId
          );
        }
      })
      .addCase(toggleWishlistOnServer.rejected, (state, action) => {
        const productId = action.payload?.productId ?? action.meta.arg.productId;
        const pendingIds = getPendingIds(state);
        state.pendingIds = pendingIds.filter((id) => id !== productId);
        state.likedProductIds = getLikedProductIds(state);
        state.lastError = action.payload?.message ?? action.error.message ?? null;
      });
  },
});

export const { setWishlist, resetWishlistState } = wishlistSlice.actions;
export default wishlistSlice.reducer;

export const selectWishlistIds = (state: RootState) =>
  state.wishlist?.likedProductIds ?? [];
export const selectIsWishlisted = (state: RootState, productId: string) =>
  (state.wishlist?.likedProductIds ?? []).includes(productId);
export const selectWishlistPendingIds = (state: RootState) =>
  state.wishlist?.pendingIds ?? [];
export const selectWishlistInitialized = (state: RootState) =>
  state.wishlist?.initialized ?? false;
export const selectWishlistError = (state: RootState) =>
  state.wishlist?.lastError ?? null;
