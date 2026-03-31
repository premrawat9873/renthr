'use client';

import { useEffect } from 'react';
import { useSupabaseAuth } from '@/lib/supabase-auth';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectIsAuthenticated } from '@/store/slices/authSlice';
import { fetchWishlist, resetWishlistState, setWishlist } from '@/store/slices/wishlistSlice';

export function useWishlistBootstrap() {
  const { status } = useSupabaseAuth();
  const reduxAuthenticated = useAppSelector(selectIsAuthenticated);
  const dispatch = useAppDispatch();
  const isAuthenticated = status === 'authenticated' || reduxAuthenticated;

  useEffect(() => {
    if (!isAuthenticated) {
      dispatch(resetWishlistState());
      return;
    }

    void dispatch(fetchWishlist());
  }, [dispatch, isAuthenticated]);
}

export function useHydrateWishlist(ids: string[] | null | undefined) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (ids == null) {
      return;
    }

    dispatch(setWishlist(ids));
  }, [ids, dispatch]);
}
