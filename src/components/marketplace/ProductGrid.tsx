import { Product, RentDuration } from "@/data/marketplaceData";
import ProductCard from "./ProductCard";
import { PackageOpen, Loader } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  products: Product[];
  rentDurations: RentDuration[];
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}

const SKELETON_COUNT = 8;
const CTA_INTERVAL = 6; // Insert CTA card after every 6th product

function CTACard() {
  return (
    <div className="bg-primary rounded-2xl p-6 flex flex-col items-center justify-center text-center text-primary-foreground h-full min-h-[260px]">
      <h3 className="font-heading font-semibold text-lg mb-2 leading-snug">
        Want to see your stuff here?
      </h3>
      <p className="text-sm opacity-90 mb-5 leading-relaxed max-w-[200px]">
        Make some extra cash by selling things in your community.
      </p>
      <button className="inline-flex items-center gap-2 bg-card text-foreground font-medium text-sm px-5 py-2.5 rounded-full hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]">
        Start Selling
      </button>
    </div>
  );
}

function ProductCardSkeleton() {
  return (
    <div className="bg-card rounded-2xl overflow-hidden border border-border/40">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="p-3.5 space-y-2.5">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3.5 w-2/5" />
        <div className="space-y-1">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <div className="pt-1 flex items-center justify-between gap-2">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
    </div>
  );
}

export default function ProductGrid({
  products,
  rentDurations,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: Props) {

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in gap-4">
        <div>
          <PackageOpen className="h-16 w-16 text-muted-foreground/40 mb-4 mx-auto" />
          <h3 className="font-heading font-medium text-lg mb-1">No items found</h3>
          <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
            Try adjusting your filters or search to find what you&apos;re looking for.
          </p>
        </div>

        {hasMore && (
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium bg-primary text-primary-foreground hover:shadow-md disabled:opacity-70 disabled:pointer-events-none transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            {isLoadingMore ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Load More Listings"
            )}
          </button>
        )}
      </div>
    );
  }

  const displayedProducts = products;
  const skeletonCount = isLoadingMore ? SKELETON_COUNT : 0;

  // Build grid items: interleave CTA cards
  const gridItems: Array<{ type: "product"; product: Product } | { type: "cta" }> = [];
  let productCount = 0;
  for (const product of displayedProducts) {
    productCount++;
    gridItems.push({ type: "product", product });
    if (productCount % CTA_INTERVAL === 0 && productCount < displayedProducts.length) {
      gridItems.push({ type: "cta" });
    }
  }

  return (
    <div className="py-6 space-y-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
        {gridItems.map((item, i) => (
          <div
            key={item.type === "product" ? `product-${item.product.id}` : `cta-${i}`}
            className="animate-fade-in"
            style={{ animationDelay: `${(i % SKELETON_COUNT) * 30}ms`, animationFillMode: "both" }}
          >
            {item.type === "cta" ? (
              <CTACard />
            ) : (
              <ProductCard
                product={item.product}
                rentDurations={rentDurations}
                priority={i === 0}
              />
            )}
          </div>
        ))}

        {skeletonCount > 0 &&
          Array.from({ length: skeletonCount }).map((_, index) => (
            <div key={`loading-skeleton-${index}`} className="animate-fade-in" style={{ animationDelay: `${index * 30}ms`, animationFillMode: "both" }}>
              <ProductCardSkeleton />
            </div>
          ))}
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium bg-primary text-primary-foreground hover:shadow-md disabled:opacity-70 disabled:pointer-events-none transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            {isLoadingMore ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
