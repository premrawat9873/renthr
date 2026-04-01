import { Search, MapPin, User, ChevronDown, X, Heart, MessageCircle, Navigation, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { logout, selectCurrentUser, selectIsAuthenticated } from "@/store/slices/authSlice";
import { resetWishlistState, selectWishlistIds } from "@/store/slices/wishlistSlice";
import { useSupabaseAuth } from "@/lib/supabase-auth";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  location: string | null;
  onRequestLocation: () => void;
  onManualLocation: (
    city: string,
    selection?: {
      city: string;
      state: string;
      latitude: number;
      longitude: number;
    }
  ) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onAddPost?: () => void;
}

type ManualLocationSelection = {
  city: string;
  state: string;
  latitude: number;
  longitude: number;
};

type LocationSuggestion = ManualLocationSelection & {
  label: string;
  country: string;
  displayName: string;
};

type LocationSearchResponse = {
  suggestions?: LocationSuggestion[];
  error?: string;
};

const RECENT_LOCATIONS_STORAGE_KEY = "renthour_recent_locations";
const POPULAR_LOCATION_QUERIES = [
  "New Delhi",
  "Mumbai",
  "Bengaluru",
  "Hyderabad",
  "Pune",
  "Chandigarh",
];

const subscribeHydration = () => () => {};

export default function MarketplaceHeader({
  location,
  onRequestLocation,
  onManualLocation,
  searchQuery,
  onSearchChange,
  onAddPost,
}: HeaderProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const reduxAuthenticated = useAppSelector(selectIsAuthenticated);
  const currentUser = useAppSelector(selectCurrentUser);
  const { status, user, signOut } = useSupabaseAuth();
  const wishlistCount = useAppSelector(selectWishlistIds).length;
  const [locOpen, setLocOpen] = useState(false);
  const [cityInput, setCityInput] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [popularSuggestions, setPopularSuggestions] = useState<LocationSuggestion[]>([]);
  const [recentSuggestions, setRecentSuggestions] = useState<LocationSuggestion[]>([]);
  const [isPopularLoading, setIsPopularLoading] = useState(false);
  const [isLocationSearchLoading, setIsLocationSearchLoading] = useState(false);
  const [locationSearchError, setLocationSearchError] = useState<string | null>(null);
  const isHydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const debouncedCityInput = useDebouncedValue(cityInput, 300);
  const dropRef = useRef<HTMLDivElement>(null);
  const cityInputRef = useRef<HTMLInputElement>(null);
  const displayLocation = isHydrated ? location : null;
  const safeWishlistCount = isHydrated ? wishlistCount : 0;
  const authReady = isHydrated && status !== "loading";
  const supabaseAuthenticated = authReady && status === "authenticated";
  const isAuthenticated = authReady && (supabaseAuthenticated || reduxAuthenticated);
  const metadataName =
    typeof user?.user_metadata?.name === "string" ? user.user_metadata.name : null;
  const accountLabel =
    (metadataName || user?.email?.split("@")[0] || currentUser?.identifier?.split("@")[0]) ||
    "Account";

  const clearCustomSessionCookie = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } catch {
      // Ignore network failures during logout cleanup.
    }
  };

  const handleLogout = async () => {
    try {
      if (supabaseAuthenticated) {
        await signOut();
      }
    } catch {
      // Ignore sign-out errors and continue with local cleanup.
    }

    await clearCustomSessionCookie();
    dispatch(logout());
    dispatch(resetWishlistState());

    router.push("/login");
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setLocOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!locOpen) {
      setCityInput("");
      setLocationSuggestions([]);
      setLocationSearchError(null);
      setIsLocationSearchLoading(false);
      return;
    }

    cityInputRef.current?.focus();

    try {
      const saved = window.localStorage.getItem(RECENT_LOCATIONS_STORAGE_KEY);
      if (!saved) {
        setRecentSuggestions([]);
      } else {
        const parsed = JSON.parse(saved) as LocationSuggestion[];
        setRecentSuggestions(Array.isArray(parsed) ? parsed.slice(0, 6) : []);
      }
    } catch {
      setRecentSuggestions([]);
    }

    const controller = new AbortController();
    void (async () => {
      try {
        setIsPopularLoading(true);

        const responses = await Promise.all(
          POPULAR_LOCATION_QUERIES.map(async (query) => {
            const response = await fetch(
              `/api/locations/search?q=${encodeURIComponent(query)}&limit=1&country=in`,
              {
                cache: "no-store",
                signal: controller.signal,
              }
            );

            const payload = (await response
              .json()
              .catch(() => null)) as LocationSearchResponse | null;

            if (!response.ok || !payload || !Array.isArray(payload.suggestions)) {
              return null;
            }

            return payload.suggestions[0] ?? null;
          })
        );

        if (controller.signal.aborted) {
          return;
        }

        const seen = new Set<string>();
        const cleaned = responses.filter((item): item is LocationSuggestion => {
          if (!item) {
            return false;
          }

          const key = `${item.label.toLowerCase()}|${item.latitude.toFixed(4)}|${item.longitude.toFixed(4)}`;
          if (seen.has(key)) {
            return false;
          }

          seen.add(key);
          return true;
        });

        setPopularSuggestions(cleaned);
      } catch {
        if (!controller.signal.aborted) {
          setPopularSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsPopularLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [locOpen]);

  useEffect(() => {
    if (!locOpen) {
      return;
    }

    const query = debouncedCityInput.trim();

    if (query.length < 2) {
      setLocationSuggestions([]);
      setLocationSearchError(null);
      setIsLocationSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    void (async () => {
      try {
        setIsLocationSearchLoading(true);
        setLocationSearchError(null);

        const response = await fetch(
          `/api/locations/search?q=${encodeURIComponent(query)}&country=in`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const payload = (await response
          .json()
          .catch(() => null)) as LocationSearchResponse | null;

        if (!response.ok || !payload) {
          throw new Error(payload?.error || "Unable to fetch locations.");
        }

        setLocationSuggestions(Array.isArray(payload.suggestions) ? payload.suggestions : []);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setLocationSuggestions([]);
        setLocationSearchError(
          error instanceof Error ? error.message : "Unable to search locations right now."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLocationSearchLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [debouncedCityInput, locOpen]);

  const saveRecentLocation = (entry: LocationSuggestion) => {
    try {
      const current = window.localStorage.getItem(RECENT_LOCATIONS_STORAGE_KEY);
      const parsed = current ? (JSON.parse(current) as LocationSuggestion[]) : [];
      const deduped = [entry, ...parsed].filter((item, index, arr) => {
        const firstIndex = arr.findIndex(
          (candidate) =>
            candidate.label.toLowerCase() === item.label.toLowerCase() &&
            candidate.latitude.toFixed(4) === item.latitude.toFixed(4) &&
            candidate.longitude.toFixed(4) === item.longitude.toFixed(4)
        );
        return firstIndex === index;
      });

      const sliced = deduped.slice(0, 6);
      window.localStorage.setItem(RECENT_LOCATIONS_STORAGE_KEY, JSON.stringify(sliced));
      setRecentSuggestions(sliced);
    } catch {
      // Ignore storage errors.
    }
  };

  const applyCity = (city: string, selection?: ManualLocationSelection, meta?: LocationSuggestion) => {
    if (meta) {
      saveRecentLocation(meta);
    }
    onManualLocation(city, selection);
    setLocOpen(false);
  };

  // Use browser geolocation to get user's current location
  const handleUseMyLocation = () => {
    onRequestLocation();
    setLocOpen(false);
  };

  const handleAddPost = () => {
    if (!isAuthenticated) {
      const currentPath =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : "/home";

      router.push(`/login?next=${encodeURIComponent(currentPath)}`);
      return;
    }

    if (onAddPost) {
      onAddPost();
      return;
    }

    router.push("/profile?openPost=1");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-primary/15 bg-accent/30 shadow-[0_6px_18px_-16px_hsl(var(--primary)/0.45)] backdrop-blur-md supports-[backdrop-filter]:bg-accent/30">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/8 via-accent/14 to-primary/8" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.08),transparent_62%)]" />

      <div className="relative z-10 flex h-14 md:h-[58px] w-full items-center gap-2 pl-2 pr-3 md:gap-3 md:pl-3 md:pr-5">
        {/* Logo */}
        <Link href="/home" className="flex items-center gap-1 shrink-0 rounded-full border border-primary/30 bg-background/45 px-2.5 py-1 backdrop-blur-sm">
          <span className="text-xl font-heading font-bold text-primary">rent</span>
          <span className="text-xl font-heading font-bold text-highlight-foreground bg-highlight px-1.5 py-0.5 rounded-lg">
            hour
          </span>
        </Link>

        {/* Location Picker */}
        <div className="relative shrink-0" ref={dropRef}>
          <button
            onClick={() => setLocOpen((current) => !current)}
            className="flex h-10 w-10 sm:w-[210px] lg:w-[240px] items-center justify-between gap-2 rounded-full border border-primary/25 bg-background/45 px-3 sm:px-4 text-sm text-foreground backdrop-blur-sm transition-colors duration-200 hover:border-primary/45"
          >
            <span className="inline-flex items-center gap-2 truncate">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="hidden sm:inline truncate">{displayLocation || "India"}</span>
            </span>
            <ChevronDown className="hidden sm:block h-3.5 w-3.5 text-muted-foreground" />
          </button>

          {locOpen && (
            <div className="absolute left-0 top-full z-[70] mt-2 w-[320px] overflow-hidden rounded-2xl border border-primary/15 bg-card shadow-xl">
              <div className="border-b border-primary/10 p-3">
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                  <input
                    ref={cityInputRef}
                    type="text"
                    placeholder="Search city or state"
                    value={cityInput}
                    onChange={(e) => setCityInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      const typed = cityInput.trim();
                      if (!typed) return;

                      if (locationSuggestions.length > 0) {
                        const firstSuggestion = locationSuggestions[0];
                        applyCity(
                          firstSuggestion.label,
                          {
                            city: firstSuggestion.city,
                            state: firstSuggestion.state,
                            latitude: firstSuggestion.latitude,
                            longitude: firstSuggestion.longitude,
                          },
                          firstSuggestion
                        );
                        return;
                      }

                      applyCity(typed);
                    }}
                    className="h-10 w-full rounded-full border border-primary/20 bg-background pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  {cityInput ? (
                    <button
                      onClick={() => setCityInput("")}
                      className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label="Clear location input"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="max-h-[340px] overflow-y-auto">
                <button
                  onClick={handleUseMyLocation}
                  className="flex w-full items-start gap-3 border-b border-primary/10 px-4 py-3 text-left transition-colors hover:bg-accent/60"
                >
                  <Navigation className="mt-0.5 h-5 w-5 text-primary" />
                  <span>
                    <span className="block text-sm font-semibold text-primary">Use current location</span>
                    <span className="block text-xs text-muted-foreground">Detect location automatically</span>
                  </span>
                </button>

                {cityInput.trim().length >= 2 ? (
                  <div className="py-1">
                    {isLocationSearchLoading ? (
                      <p className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Searching locations...
                      </p>
                    ) : null}

                    {!isLocationSearchLoading && locationSuggestions.length > 0
                      ? locationSuggestions.map((suggestion) => {
                          const caption = [suggestion.country, suggestion.displayName]
                            .filter(Boolean)
                            .join(" - ");

                          return (
                            <button
                              key={`${suggestion.label}-${suggestion.latitude.toFixed(5)}-${suggestion.longitude.toFixed(5)}`}
                              onClick={() =>
                                applyCity(
                                  suggestion.label,
                                  {
                                    city: suggestion.city,
                                    state: suggestion.state,
                                    latitude: suggestion.latitude,
                                    longitude: suggestion.longitude,
                                  },
                                  suggestion
                                )
                              }
                              className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent/60"
                            >
                              <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                              <span className="min-w-0">
                                <span className="block truncate text-sm text-foreground">{suggestion.label}</span>
                                {caption ? (
                                  <span className="block truncate text-xs text-muted-foreground">{caption}</span>
                                ) : null}
                              </span>
                            </button>
                          );
                        })
                      : null}

                    {!isLocationSearchLoading && locationSuggestions.length === 0 ? (
                      <div className="space-y-1 px-4 py-3">
                        <p className="text-xs text-muted-foreground">
                          {locationSearchError || "No matching locations found."}
                        </p>
                        {!locationSearchError ? (
                          <button
                            onClick={() => applyCity(cityInput.trim())}
                            className="text-sm font-medium text-primary hover:underline"
                          >
                            Use &quot;{cityInput.trim()}&quot;
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="py-2">
                    {recentSuggestions.length > 0 ? (
                      <>
                        <p className="px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                          Recent locations
                        </p>
                        {recentSuggestions.map((suggestion) => (
                          <button
                            key={`recent-${suggestion.label}-${suggestion.latitude.toFixed(5)}-${suggestion.longitude.toFixed(5)}`}
                            onClick={() =>
                              applyCity(
                                suggestion.label,
                                {
                                  city: suggestion.city,
                                  state: suggestion.state,
                                  latitude: suggestion.latitude,
                                  longitude: suggestion.longitude,
                                },
                                suggestion
                              )
                            }
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent/60"
                          >
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="truncate text-sm text-foreground">{suggestion.label}</span>
                          </button>
                        ))}
                        <div className="my-1 border-t border-primary/10" />
                      </>
                    ) : null}

                    <p className="px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      Popular locations
                    </p>

                    {isPopularLoading ? (
                      <p className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading popular locations...
                      </p>
                    ) : null}

                    {!isPopularLoading && popularSuggestions.length > 0
                      ? popularSuggestions.map((suggestion) => (
                          <button
                            key={`popular-${suggestion.label}-${suggestion.latitude.toFixed(5)}-${suggestion.longitude.toFixed(5)}`}
                            onClick={() =>
                              applyCity(
                                suggestion.label,
                                {
                                  city: suggestion.city,
                                  state: suggestion.state,
                                  latitude: suggestion.latitude,
                                  longitude: suggestion.longitude,
                                },
                                suggestion
                              )
                            }
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent/60"
                          >
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="truncate text-sm text-foreground">{suggestion.label}</span>
                          </button>
                        ))
                      : null}

                    {!isPopularLoading && popularSuggestions.length === 0 ? (
                      <p className="px-4 py-2 text-xs text-muted-foreground">
                        Start typing to search locations.
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative hidden flex-1 sm:mx-4 sm:block">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-10 w-full rounded-full border border-primary/25 bg-background/50 pl-10 pr-16 text-sm placeholder:text-muted-foreground backdrop-blur-sm transition-all duration-200 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all duration-200 hover:brightness-105"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </button>
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-10 top-1/2 -translate-y-1/2"
            >
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
            </button>
          )}
        </div>

        {/* Right Actions */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <button
            onClick={() =>
              router.push(
                isAuthenticated ? "/profile" : "/login?next=/profile"
              )
            }
            className="hidden md:flex flex-col items-center justify-center text-[11px] leading-none text-primary hover:text-primary/80 transition-colors min-w-[48px]"
          >
            <Heart className="h-4 w-4 mb-1" />
            {safeWishlistCount > 0 ? `Wishlist (${safeWishlistCount})` : "Wishlist"}
          </button>

          <Button
            variant="ghost"
            size="sm"
            className="inline-flex items-center gap-1.5 h-9 rounded-full border border-primary/25 bg-background/45 px-3 text-xs font-medium text-primary backdrop-blur-sm transition-colors hover:border-primary/40 hover:bg-background/55"
            onClick={() =>
              router.push(
                isAuthenticated ? "/messages" : "/login?next=/messages"
              )
            }
          >
            <MessageCircle className="h-4 w-4" />
            <span className="hidden lg:inline">Messages</span>
            <span className="lg:hidden">Chat</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="hidden md:flex items-center gap-1.5 h-10 rounded-full border border-primary/25 bg-background/45 px-3 text-xs font-medium text-primary backdrop-blur-sm transition-colors min-w-[96px] hover:border-primary/40 hover:bg-background/55">
                <User className="h-4 w-4" />
                <span className="max-w-[92px] truncate">
                  {isAuthenticated ? accountLabel : "Login"}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {!isAuthenticated ? (
                <DropdownMenuItem onClick={() => router.push("/login")}>
                  Login
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => router.push("/profile")}>
                    Profile & Posts
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => void handleLogout()}>
                    Logout
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="highlight"
            size="sm"
            className="gap-1.5 rounded-full border border-highlight/55"
            onClick={handleAddPost}
          >
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Add Post</span>
          </Button>
        </div>
      </div>

      {/* Mobile Search */}
      <div className="sm:hidden px-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9 w-full rounded-full border border-primary/25 bg-background/50 pl-10 pr-3 text-sm placeholder:text-muted-foreground backdrop-blur-sm transition-all duration-200 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

    </header>
  );
}
