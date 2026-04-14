import { useRouter } from "next/navigation";
import {
  ListingFilter,
  Product,
  formatTimeAgo,
  formatPrice,
  RentDuration,
} from "@/data/marketplaceData";
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
import { getProductHref } from "@/lib/product-url";

interface Props {
  product: Product;
  listingFilter: ListingFilter;
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

export default function ProductCard({
  product,
  listingFilter,
  priority = false,
}: Props) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const liked = useAppSelector((state) => selectIsWishlisted(state, product.id));
  const pendingIds = useAppSelector(selectWishlistPendingIds);
  const isUpdating = pendingIds.includes(product.id);
  const images = product.images?.length > 0 ? product.images : [product.image];
  const distanceLabel = formatDistanceLabel(product.distance);
  const isRentAvailable = product.type === "rent" || product.type === "both";
  const isSellAvailable = product.type === "sell" || product.type === "both";
  const showRentPrices = listingFilter !== "sell";
  const showSellPrices = listingFilter !== "rent";
  const isAvailable = product.isAvailable ?? true;
  const reviewCount = product.reviewCount ?? 0;
  const ratingValue = product.rating;
  const hasReviews = typeof ratingValue === "number" && reviewCount > 0;
  const productHref = getProductHref(product);

  return (
    <div
      onClick={() => router.push(productHref)}
      className={`group relative isolate flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_8px_18px_-14px_hsl(var(--foreground)/0.55)] transition-shadow duration-200 card-lift ${
        product.featured ? "shadow-md ring-1 ring-highlight/35" : "hover:shadow-[0_12px_24px_-14px_hsl(var(--foreground)/0.5)]"
      }`}
    >
      {product.featured && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[3px] bg-highlight"
        />
      )}

      {/* Image */}
      <div className={`relative aspect-[4/3] shrink-0 overflow-hidden rounded-t-2xl bg-muted ${!isAvailable ? "grayscale" : ""}`}>
        <ImageCarousel
          images={images}
          alt={product.title}
          priority={priority}
          className="rounded-t-2xl"
        />
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
          aria-label={liked ? `Remove ${product.title} from wishlist` : `Save ${product.title} to wishlist`}
          className="absolute top-2.5 right-2.5 h-8 w-8 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center transition-all duration-200 hover:bg-card hover:scale-110 active:scale-95 z-10 disabled:opacity-70"
        >
          <Heart
            className={`h-4 w-4 transition-all duration-200 ${liked ? "fill-destructive text-destructive" : "text-foreground/60"}`}
          />
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col space-y-2 p-3.5">
        {/* Price */}
        <div className="space-y-0.5">
          {showSellPrices && isSellAvailable && (
            <p className="text-base font-extrabold text-foreground">
              {product.price != null
                ? `Sell ${formatPrice(product.price)}`
                : "Selling price on request"}
            </p>
          )}
          {showRentPrices && isRentAvailable && (
            product.rentPrices ? (
              <div className="grid grid-cols-1 gap-0.5">
                {renderRentPrice(product)}
              </div>
            ) : (
              <p className="text-base font-extrabold text-foreground">Rent price on request</p>
            )
          )}
        </div>

        <h3 className="font-heading text-sm font-semibold leading-snug line-clamp-2 text-foreground">
          {product.title}
        </h3>

        {/* Rating (rent only) */}
        {isRentAvailable && (
          <div className="flex items-center gap-1.5">
            <Star
              className={`h-3.5 w-3.5 ${hasReviews ? "fill-star text-star" : "text-muted-foreground"}`}
            />
            <span className="text-xs font-medium text-foreground">
              {hasReviews ? ratingValue.toFixed(1) : "0.0"}
            </span>
            <span className="text-xs text-muted-foreground">
              ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
            </span>
          </div>
        )}

        {/* Meta */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
          <span className="flex min-w-0 flex-1 items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {product.location}
              {distanceLabel ? ` · ${distanceLabel}` : ""}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatTimeAgo(product.postedAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

function renderRentPrice(product: Product) {
  const rp = product.rentPrices!;
  const items: Array<{ key: RentDuration; label: string; suffix: string; price: number }> = [];

  if (rp.hourly != null) {
    items.push({ key: "hourly", label: "Hourly", suffix: "/hr", price: rp.hourly });
  }

  if (rp.daily != null) {
    items.push({ key: "daily", label: "Daily", suffix: "/day", price: rp.daily });
  }

  if (rp.weekly != null) {
    items.push({ key: "weekly", label: "Weekly", suffix: "/wk", price: rp.weekly });
  }

  if (rp.monthly != null) {
    items.push({ key: "monthly", label: "Monthly", suffix: "/mo", price: rp.monthly });
  }

  if (items.length === 0) {
    return (
      <p className="text-sm font-semibold text-foreground">Rent price on request</p>
    );
  }

  return items.map((item) => (
    <p key={item.key} className="text-[0.95rem] font-bold text-foreground leading-tight">
      {item.label} {formatPrice(item.price)}
      <span className="font-normal text-muted-foreground">{item.suffix}</span>
    </p>
  ));
}
