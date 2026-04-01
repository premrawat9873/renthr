import { useRouter } from "next/navigation";
import { Product, formatTimeAgo, formatPrice, RentDuration } from "@/data/marketplaceData";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Heart, Star, Tag, CalendarClock } from "lucide-react";
import ImageCarousel from "./ImageCarousel";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  selectIsWishlisted,
  selectWishlistPendingIds,
  toggleWishlistOnServer,
} from "@/store/slices/wishlistSlice";
import { toast } from "@/hooks/use-toast";

interface Props {
  product: Product;
  rentDurations: RentDuration[];
  priority?: boolean;
}

function formatDistanceLabel(distance: number) {
  if (!Number.isFinite(distance) || distance < 0) {
    return null;
  }

  if (distance === 0) {
    return '0 km';
  }

  return `${distance.toFixed(1)} km`;
}

export default function ProductCard({ product, rentDurations, priority = false }: Props) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const liked = useAppSelector((state) => selectIsWishlisted(state, product.id));
  const pendingIds = useAppSelector(selectWishlistPendingIds);
  const isUpdating = pendingIds.includes(product.id);
  const images = product.images?.length > 0 ? product.images : [product.image];
  const distanceLabel = formatDistanceLabel(product.distance);
  const isRentAvailable = product.type === "rent" || product.type === "both";
  const isSellAvailable = product.type === "sell" || product.type === "both";
  const isAvailable = product.isAvailable ?? true;

  return (
    <div
      onClick={() => router.push(`/product/${product.id}`)}
      className={`group bg-card rounded-2xl overflow-hidden card-lift cursor-pointer relative ${
        product.featured ? "border-l-[3px] border-l-highlight shadow-md" : ""
      }`}
    >
      {/* Image */}
      <div className={`relative aspect-[4/3] overflow-hidden bg-muted ${!isAvailable ? "grayscale" : ""}`}>
        <ImageCarousel images={images} alt={product.title} priority={priority} />
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10">
          {product.featured && (
            <Badge className="text-[10px] uppercase tracking-wider px-2.5 py-1 bg-highlight/90 text-highlight-foreground border-transparent">
              Featured
            </Badge>
          )}
          {!isAvailable && (
            <Badge variant="destructive" className="text-[10px] uppercase tracking-wider px-2.5 py-1">
              Unavailable
            </Badge>
          )}
          {isRentAvailable && (
            <Badge variant="rent" className="text-[10px] uppercase tracking-wider px-2.5 py-1">
              <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" />Rent</span>
            </Badge>
          )}
          {isSellAvailable && (
            <Badge variant="sell" className="text-[10px] uppercase tracking-wider px-2.5 py-1">
              <span className="flex items-center gap-1"><Tag className="h-3 w-3" />Sell</span>
            </Badge>
          )}
        </div>
        {/* Heart/Bookmark */}
        <button
          onClick={async (e) => {
            e.stopPropagation();
            const result = await dispatch(
              toggleWishlistOnServer({ productId: product.id, like: !liked })
            );

            if (toggleWishlistOnServer.rejected.match(result)) {
              const description =
                result.payload?.message || 'Please log in to save items.';

              toast({
                title: 'Could not update wishlist',
                description,
                variant: 'destructive',
              });
            }
          }}
          disabled={isUpdating}
          aria-busy={isUpdating}
          className="absolute top-2.5 right-2.5 h-8 w-8 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center transition-all duration-200 hover:bg-card hover:scale-110 active:scale-95 z-10 disabled:opacity-70"
        >
          <Heart
            className={`h-4 w-4 transition-all duration-200 ${liked ? "fill-destructive text-destructive" : "text-foreground/60"}`}
          />
        </button>
      </div>

      {/* Content */}
      <div className="p-3.5 space-y-2">
        <h3 className="font-heading font-medium text-sm leading-snug line-clamp-2">
          {product.title}
        </h3>

        {/* Rating (rent only) */}
        {isRentAvailable && product.rating != null && (
          <div className="flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 fill-star text-star" />
            <span className="text-xs font-medium text-foreground">{product.rating.toFixed(1)}</span>
            {product.reviewCount != null && (
              <span className="text-xs text-muted-foreground">({product.reviewCount} reviews)</span>
            )}
          </div>
        )}

        {/* Price */}
        <div className="space-y-0.5">
          {isSellAvailable && (
            <p className="text-sm font-semibold text-foreground">
              {product.price != null
                ? `Selling price ${formatPrice(product.price)}`
                : "Selling price on request"}
            </p>
          )}
          {isRentAvailable && (
            product.rentPrices ? (
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                {renderRentPrice(product, rentDurations)}
              </div>
            ) : (
              <p className="text-sm font-semibold text-foreground">Rent price on request</p>
            )
          )}
        </div>

        {/* Meta */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {product.location}
            {distanceLabel ? ` · ${distanceLabel}` : ""}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatTimeAgo(product.postedAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

function renderRentPrice(product: Product, durations: RentDuration[]) {
  const rp = product.rentPrices!;
  const show = durations.length > 0 ? durations : (["daily"] as RentDuration[]);
  const items: { label: string; price: number | null }[] = [];

  for (const d of show) {
    if (d === "hourly" && rp.hourly != null) items.push({ label: "/hr", price: rp.hourly });
    if (d === "daily" && rp.daily != null) items.push({ label: "/day", price: rp.daily });
    if (d === "weekly" && rp.weekly != null) items.push({ label: "/wk", price: rp.weekly });
    if (d === "monthly" && rp.monthly != null) items.push({ label: "/mo", price: rp.monthly });
  }

  if (items.length === 0 && rp.daily != null) {
    items.push({ label: "/day", price: rp.daily });
  }

  if (items.length === 0 && rp.hourly != null) {
    items.push({ label: "/hr", price: rp.hourly });
  }

  if (items.length === 0 && rp.weekly != null) {
    items.push({ label: "/wk", price: rp.weekly });
  }

  if (items.length === 0 && rp.monthly != null) {
    items.push({ label: "/mo", price: rp.monthly });
  }

  if (items.length === 0) {
    return (
      <p className="text-sm font-semibold text-foreground">Rent price on request</p>
    );
  }

  return items.map((item) => (
    <span key={item.label} className="text-sm font-semibold text-foreground">
      Rent {formatPrice(item.price!)}<span className="font-normal text-muted-foreground">{item.label}</span>
    </span>
  ));
}
