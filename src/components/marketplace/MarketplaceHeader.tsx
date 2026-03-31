import { Search, MapPin, User, ChevronDown, X, Heart, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { logout, selectCurrentUser, selectIsAuthenticated } from "@/store/slices/authSlice";
import { resetWishlistState, selectWishlistIds } from "@/store/slices/wishlistSlice";
import { useSupabaseAuth } from "@/lib/supabase-auth";
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
  onManualLocation: (city: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

const CITIES = [
  "Mumbai",
  "Delhi",
  "Chandigarh",
  "Faridabad",
  "Noida",
  "Gurgaon",
  "Bangalore",
  "Hyderabad",
  "Chennai",
  "Pune",
  "Kolkata",
  "Ahmedabad",
  "Jaipur",
  "Lucknow",
];

const subscribeHydration = () => () => {};

export default function MarketplaceHeader({
  location,
  onRequestLocation,
  onManualLocation,
  searchQuery,
  onSearchChange,
}: HeaderProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const reduxAuthenticated = useAppSelector(selectIsAuthenticated);
  const currentUser = useAppSelector(selectCurrentUser);
  const { status, user, signOut } = useSupabaseAuth();
  const wishlistCount = useAppSelector(selectWishlistIds).length;
  const [locOpen, setLocOpen] = useState(false);
  const [cityInput, setCityInput] = useState("");
  const isHydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const dropRef = useRef<HTMLDivElement>(null);
  const displayLocation = isHydrated ? location : null;
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

  // Filter cities based on input
  const filteredCities = cityInput
    ? CITIES.filter((c) => c.toLowerCase().includes(cityInput.toLowerCase()))
    : CITIES;

  const applyCity = (city: string) => {
    onManualLocation(city);
    setLocOpen(false);
    setCityInput("");
  };

  // Use browser geolocation to get user's current location
  const handleUseMyLocation = () => {
    onRequestLocation();
    setLocOpen(false);
    setCityInput("");
  };

  return (
    <header className="sticky top-0 z-50 overflow-hidden border-b border-primary/15 bg-accent/30 shadow-[0_6px_18px_-16px_hsl(var(--primary)/0.45)] backdrop-blur-md supports-[backdrop-filter]:bg-accent/30">
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
            onClick={() => setLocOpen(!locOpen)}
            className="flex h-10 w-10 sm:w-[210px] lg:w-[240px] items-center justify-between gap-2 rounded-full border border-primary/25 bg-background/45 px-3 sm:px-4 text-sm text-foreground backdrop-blur-sm transition-colors duration-200 hover:border-primary/45"
          >
            <span className="inline-flex items-center gap-2 truncate">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="hidden sm:inline truncate">{displayLocation || "India"}</span>
            </span>
            <ChevronDown className="hidden sm:block h-3.5 w-3.5 text-muted-foreground" />
          </button>

          {locOpen && (
            <div className="absolute left-0 top-full mt-2 w-64 rounded-xl border border-primary/15 bg-card shadow-lg p-3 space-y-2">
              {/* Use My Location Button */}
              <button
                onClick={handleUseMyLocation}
                className="w-full text-left text-sm font-medium text-primary hover:bg-accent rounded-lg px-3 py-2.5 transition-colors duration-200"
              >
                📍 Use my location
              </button>

              <div className="border-t border-primary/10" />

              {/* City Search Input */}
              <input
                type="text"
                placeholder="Type a city..."
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  const typed = cityInput.trim();
                  if (!typed) return;
                  if (filteredCities.length > 0) {
                    applyCity(filteredCities[0]);
                    return;
                  }
                  applyCity(typed);
                }}
                className="w-full h-9 px-3 rounded-lg border border-primary/15 bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/25 focus:border-primary/35 transition-all duration-200"
              />

              {/* City List */}
              <div className="max-h-36 overflow-y-auto space-y-0.5">
                {filteredCities.map((city) => (
                  <button
                    key={city}
                    onClick={() => applyCity(city)}
                    className="w-full text-left text-sm px-3 py-1.5 rounded-lg hover:bg-accent transition-colors duration-200"
                  >
                    {city}
                  </button>
                ))}
                {filteredCities.length === 0 && cityInput.trim() && (
                  <button
                    onClick={() => applyCity(cityInput.trim())}
                    className="w-full text-left text-sm px-3 py-1.5 rounded-lg text-primary hover:bg-accent transition-colors duration-200"
                  >
                    Use &quot;{cityInput.trim()}&quot;
                  </button>
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
            {wishlistCount > 0 ? `Wishlist (${wishlistCount})` : "Wishlist"}
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
                    Profile & Listings
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
            onClick={() =>
              router.push(isAuthenticated ? "/profile" : "/login?next=/profile")
            }
          >
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">My Listings</span>
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
