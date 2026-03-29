import { useState } from "react";
import { Category } from "@/data/marketplaceData";
import { CATEGORIES, VISIBLE_COUNT } from "@/data/mockData";
import {
  X, Smartphone, Car, Sofa, Shirt, BookOpen, Dribbble, Wrench,
  Camera, Music, Gamepad2, Home, Baby, Flower2, PawPrint, Palette,
  Dumbbell, Monitor,
} from "lucide-react";
import { LucideIcon } from "lucide-react";

interface Props {
  selected: string | null;
  onSelect: (id: string | null) => void;
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
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

export default function CategorySection({ selected, onSelect }: Props) {
  const [showMore, setShowMore] = useState(false);
  const visible = CATEGORIES.slice(0, VISIBLE_COUNT);
  const hidden = CATEGORIES.slice(VISIBLE_COUNT);

  return (
    <section className="py-5">
      <div className="flex flex-wrap gap-2">
        {visible.map((cat) => (
          <CategoryPill
            key={cat.id}
            cat={cat}
            active={selected === cat.id}
            onClick={() => onSelect(selected === cat.id ? null : cat.id)}
          />
        ))}
        <button
          onClick={() => setShowMore(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border border-border/60 text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-sm transition-all duration-200"
        >
          Others +{hidden.length}
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
                  active={selected === cat.id}
                  onClick={() => { onSelect(selected === cat.id ? null : cat.id); setShowMore(false); }}
                />
              ))}
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
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border ${
        active
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-card border-border/60 text-foreground hover:bg-accent hover:border-accent hover:shadow-sm"
      }`}
    >
      {Icon && <Icon className="h-4 w-4" strokeWidth={1.75} />}
      <span>{cat.label}</span>
    </button>
  );
}
