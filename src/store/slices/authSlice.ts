import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "@/store/store";

export type LoginTab = "email" | "phone";

interface AuthUser {
  id: string;
  identifier: string;
  loginMethod: LoginTab;
}

interface AuthState {
  loginTab: LoginTab;
  isAuthenticated: boolean;
  token: string | null;
  user: AuthUser | null;
}

const initialState: AuthState = {
  loginTab: "email",
  isAuthenticated: false,
  token: null,
  user: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setLoginTab(state, action: PayloadAction<LoginTab>) {
      state.loginTab = action.payload;
    },
    loginWithEmail(state, action: PayloadAction<{ email: string }>) {
      const email = action.payload.email.trim();
      state.isAuthenticated = email.length > 0;
      state.user = email.length
        ? {
            id: email.toLowerCase(),
            identifier: email,
            loginMethod: "email",
          }
        : null;
      state.token = email.length > 0 ? `demo-email-token-${Date.now()}` : null;
    },
    loginWithPhone(state, action: PayloadAction<{ phone: string }>) {
      const phone = action.payload.phone.trim();
      state.isAuthenticated = phone.length > 0;
      state.user = phone.length
        ? {
            id: phone,
            identifier: phone,
            loginMethod: "phone",
          }
        : null;
      state.token = phone.length > 0 ? `demo-phone-token-${Date.now()}` : null;
    },
    logout(state) {
      state.isAuthenticated = false;
      state.token = null;
      state.user = null;
    },
  },
});

export const { setLoginTab, loginWithEmail, loginWithPhone, logout } = authSlice.actions;

export default authSlice.reducer;

export const selectAuthState = (state: RootState) => state.auth;
export const selectLoginTab = (state: RootState) => state.auth.loginTab;
export const selectIsAuthenticated = (state: RootState) => state.auth.isAuthenticated;
export const selectCurrentUser = (state: RootState) => state.auth.user;
