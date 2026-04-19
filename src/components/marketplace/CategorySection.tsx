import { useMemo, useState } from "react";
import { Category } from "@/data/marketplaceData";
import { CATEGORIES, VISIBLE_COUNT } from "@/data/mockData";
import {
  X, Smartphone, Car, Sofa, Shirt, BookOpen, Dribbble, Wrench,
  Camera, Music, Gamepad2, Home, Baby, Flower2, PawPrint, Palette,
  Dumbbell, Monitor,
} from "lucide-react";
import { LucideIcon } from "lucide-react";

interface Props {
  selected: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  flat: Home,
  pg: Home,
  electronics: Smartphone,
  vehicles: Car,
  furniture: Sofa,
  fashion: Shirt,
  books: BookOpen,
  sports: Dribbble,
  tools: Wrench,
  cameras: Camera,
  music: Music,
  gaming: Gamepad2,
  appliances: Home,
  toys: Baby,
  garden: Flower2,
  pets: PawPrint,
  art: Palette,
  fitness: Dumbbell,
  baby: Baby,
  office: Monitor,
};

export default function CategorySection({ selected, onToggle, onClear }: Props) {
  const [showMore, setShowMore] = useState(false);
  const visible = CATEGORIES.slice(0, VISIBLE_COUNT);
  const hidden = CATEGORIES.slice(VISIBLE_COUNT);
  const selectedLookup = useMemo(() => new Set(selected), [selected]);
  const isAllSelected = selected.length === 0;
  const hiddenSelectedCount = hidden.filter((cat) => selectedLookup.has(cat.id)).length;

  return (
    <section className="py-5">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onClear}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors duration-150 border ${
            isAllSelected
              ? "bg-accent text-foreground border-primary/55"
              : "bg-card border-border text-foreground hover:bg-accent/45 hover:border-primary/35"
          }`}
        >
          All
        </button>
        {visible.map((cat) => (
          <CategoryPill
            key={cat.id}
            cat={cat}
            active={selectedLookup.has(cat.id)}
            onClick={() => onToggle(cat.id)}
          />
        ))}
        <button
          onClick={() => setShowMore(true)}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border transition-colors duration-150 ${
            showMore || hiddenSelectedCount > 0
              ? "bg-accent text-foreground border-primary/55"
              : "border-border text-foreground/80 hover:bg-accent/45 hover:text-foreground hover:border-primary/35"
          }`}
        >
          Others
          {hiddenSelectedCount > 0 ? (
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
              {hiddenSelectedCount}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">+{hidden.length}</span>
          )}
        </button>
      </div>

      {/* Others modal */}
      {showMore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm" onClick={() => setShowMore(false)}>
          <div className="bg-card rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-medium text-lg">More Categories</h3>
              <button onClick={() => setShowMore(false)} className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {hidden.map((cat) => (
                <CategoryPill
                  key={cat.id}
                  cat={cat}
                  active={selectedLookup.has(cat.id)}
                  onClick={() => onToggle(cat.id)}
                />
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onClear}
                className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={() => setShowMore(false)}
                className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function CategoryPill({ cat, active, onClick }: { cat: Category; active: boolean; onClick: () => void }) {
  const Icon = CATEGORY_ICONS[cat.id];
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors duration-150 border ${
        active
          ? "bg-accent text-foreground border-primary/55"
          : "bg-card border-border text-foreground hover:bg-accent/45 hover:border-primary/35"
      }`}
    >
      {Icon && <Icon className="h-4 w-4" strokeWidth={1.75} />}
      <span>{cat.label}</span>
    </button>
  );
}
