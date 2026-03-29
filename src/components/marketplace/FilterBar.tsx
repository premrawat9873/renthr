import { ListingFilter, RentDuration, SortOption } from "@/data/marketplaceData";
import { SlidersHorizontal, X } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import LocationSelector, { type LocationData } from "./LocationSelector";

interface Props {
  filter: ListingFilter;
  onFilterChange: (f: ListingFilter) => void;
  rentDurations: RentDuration[];
  onRentDurationsChange: (d: RentDuration[]) => void;
  sort: SortOption;
  onSortChange: (s: SortOption) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  priceRange: [number, number];
  onPriceRangeChange: (r: [number, number]) => void;
  location?: LocationData | null;
  onLocationChange?: (location: LocationData | null) => void;
}

const TABS: { value: ListingFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "rent", label: "For Rent" },
  { value: "sell", label: "For Sale" },
];

const DURATIONS: { value: RentDuration; label: string }[] = [
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const SORTS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low → High" },
  { value: "price-desc", label: "Price: High → Low" },
  { value: "distance", label: "Nearest" },
];

const MAX_PRICE = 200000;

export default function FilterBar({
  filter, onFilterChange, rentDurations, onRentDurationsChange,
  sort, onSortChange, hasActiveFilters, onClearFilters,
  priceRange, onPriceRangeChange,
  location, onLocationChange,
}: Props) {
  const [sortOpen, setSortOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);

  const toggleDuration = (d: RentDuration) => {
    if (rentDurations.includes(d)) {
      onRentDurationsChange(rentDurations.filter((x) => x !== d));
    } else {
      onRentDurationsChange([...rentDurations, d]);
    }
  };

  const priceActive = priceRange[0] > 0 || priceRange[1] < MAX_PRICE;

  return (
    <div className="space-y-3 py-4 border-b border-border/40">
      <div className="flex flex-wrap items-center gap-2">
        {/* Main tabs */}
        <div className="flex bg-muted/50 rounded-full p-1">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => onFilterChange(tab.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                filter === tab.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Price range toggle */}
        <div className="relative">
          <button
            onClick={() => setPriceOpen(!priceOpen)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full border text-sm font-medium transition-all duration-200 ${
              priceActive
                ? "border-primary bg-primary/5 text-primary"
                : "border-border/60 text-muted-foreground hover:bg-muted/50 hover:shadow-sm"
            }`}
          >
            ₹ Price
          </button>
          {priceOpen && (
            <div className="absolute left-0 top-full mt-2 w-80 rounded-2xl border border-border/40 bg-card shadow-xl p-5 z-20 animate-fade-in space-y-5">
              <p className="text-sm font-medium text-foreground">Price range</p>
              <DualRangeSlider
                min={0}
                max={MAX_PRICE}
                step={1000}
                value={priceRange}
                onChange={onPriceRangeChange}
              />
              <div className="flex items-center gap-3">
                <div className="flex-1 rounded-xl border border-border/60 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Min</div>
                  <div className="text-sm font-medium">₹{priceRange[0].toLocaleString("en-IN")}</div>
                </div>
                <span className="text-muted-foreground">—</span>
                <div className="flex-1 rounded-xl border border-border/60 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Max</div>
                  <div className="text-sm font-medium">₹{priceRange[1].toLocaleString("en-IN")}{priceRange[1] >= MAX_PRICE ? "+" : ""}</div>
                </div>
              </div>
              <div className="flex justify-between">
                <button
                  onClick={() => { onPriceRangeChange([0, MAX_PRICE]); }}
                  className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
                >
                  Reset
                </button>
                <button
                  onClick={() => setPriceOpen(false)}
                  className="text-xs font-medium text-primary hover:underline transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Location selector */}
        {onLocationChange && (
          <LocationSelector
            location={location || null}
            onLocationChange={onLocationChange}
          />
        )}

        <div className="flex-1" />

        {/* Sort */}
        <div className="relative">
          <button
            onClick={() => setSortOpen(!sortOpen)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-border/60 text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:shadow-sm transition-all duration-200"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {SORTS.find((s) => s.value === sort)?.label}
          </button>
          {sortOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-border/40 bg-card shadow-xl py-2 z-20 animate-fade-in">
              {SORTS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => { onSortChange(s.value); setSortOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-accent transition-colors ${
                    sort === s.value ? "font-medium text-primary" : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="flex items-center gap-1 px-4 py-1.5 rounded-full text-sm font-medium text-destructive hover:bg-destructive/10 transition-all duration-200"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Rent duration sub-filters */}
      {filter === "rent" && (
        <div className="flex flex-wrap items-center gap-2 animate-fade-in">
          <span className="text-xs text-muted-foreground font-medium">Duration:</span>
          {DURATIONS.map((d) => {
            const active = rentDurations.includes(d.value);
            return (
              <button
                key={d.value}
                onClick={() => toggleDuration(d.value)}
                className={`px-3.5 py-1 rounded-full text-xs font-medium transition-all duration-200 border ${
                  active
                    ? "bg-accent text-accent-foreground border-accent shadow-sm"
                    : "bg-card border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Custom Dual Range Slider ─── */

function DualRangeSlider({ min, max, step, value, onChange }: {
  min: number;
  max: number;
  step: number;
  value: [number, number];
  onChange: (v: [number, number]) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  const getPercent = (v: number) => ((v - min) / (max - min)) * 100;
  const minPercent = getPercent(value[0]);
  const maxPercent = getPercent(value[1]);

  const handlePointer = useCallback((e: React.PointerEvent, thumb: "min" | "max") => {
    e.preventDefault();
    const track = trackRef.current;
    if (!track) return;

    const move = (ev: PointerEvent) => {
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      const raw = min + ratio * (max - min);
      const snapped = Math.round(raw / step) * step;

      if (thumb === "min") {
        onChange([Math.min(snapped, value[1] - step), value[1]]);
      } else {
        onChange([value[0], Math.max(snapped, value[0] + step)]);
      }
    };

    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, [min, max, step, value, onChange]);

  return (
    <div ref={trackRef} className="relative h-6 flex items-center select-none touch-none">
      {/* Track background */}
      <div className="absolute inset-x-0 h-1.5 rounded-full bg-muted" />
      {/* Active range */}
      <div
        className="absolute h-1.5 rounded-full bg-primary"
        style={{ left: `${minPercent}%`, right: `${100 - maxPercent}%` }}
      />
      {/* Min thumb */}
      <div
        className="absolute h-5 w-5 rounded-full bg-card border-2 border-primary shadow-sm cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
        style={{ left: `${minPercent}%`, transform: "translateX(-50%)" }}
        onPointerDown={(e) => handlePointer(e, "min")}
      />
      {/* Max thumb */}
      <div
        className="absolute h-5 w-5 rounded-full bg-card border-2 border-primary shadow-sm cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
        style={{ left: `${maxPercent}%`, transform: "translateX(-50%)" }}
        onPointerDown={(e) => handlePointer(e, "max")}
      />
    </div>
  );
}
