import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";

import { formatPrice, formatTimeAgo, type Product } from "@/data/marketplaceData";
import { getProductHref } from "@/lib/product-url";

function getPriceSummary(product: Product) {
  const rentDaily = product.rentPrices?.daily ?? null;

  if (product.type === "both") {
    if (product.price != null && rentDaily != null) {
      return `Buy ${formatPrice(product.price)} or Rent ${formatPrice(rentDaily)}/day`;
    }

    if (product.price != null) {
      return `Buy ${formatPrice(product.price)}`;
    }

    if (rentDaily != null) {
      return `Rent ${formatPrice(rentDaily)}/day`;
    }
  }

  if (product.type === "sell" && product.price != null) {
    return formatPrice(product.price);
  }

  if (product.rentPrices) {
    const fallbackRentPrice =
      product.rentPrices.daily ??
      product.rentPrices.hourly ??
      product.rentPrices.weekly ??
      product.rentPrices.monthly ??
      null;

    if (fallbackRentPrice != null) {
      return `Rent ${formatPrice(fallbackRentPrice)}`;
    }
  }

  return "Price on request";
}

function getListingTypeLabel(type: Product["type"]) {
  if (type === "both") {
    return "Rent or Sell";
  }

  return type === "rent" ? "For Rent" : "For Sale";
}

interface UserListingsGridProps {
  products: Product[];
  emptyTitle: string;
  emptyDescription: string;
}

export default function UserListingsGrid({
  products,
  emptyTitle,
  emptyDescription,
}: UserListingsGridProps) {
  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-primary/35 bg-card px-6 py-10 text-center">
        <h2 className="font-heading text-xl font-semibold">{emptyTitle}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <article
          key={product.id}
          className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm transition-shadow hover:shadow-md"
        >
          <Link href={getProductHref(product)} className="block">
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted/50">
              <Image
                src={product.image}
                alt={product.title}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="object-cover"
              />
            </div>
            <div className="space-y-2 p-4">
              <p className="line-clamp-2 text-sm font-semibold text-foreground">{product.title}</p>
              <div className="flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5 fill-current text-primary" />
                <span className="text-xs font-medium text-foreground">
                  {product.rating != null ? product.rating.toFixed(1) : "No ratings"}
                </span>
                <span className="text-xs text-muted-foreground">({product.reviewCount ?? 0} reviews)</span>
              </div>
              <p className="text-xs font-medium uppercase tracking-wide text-primary">
                {getListingTypeLabel(product.type)}
              </p>
              <p className="text-sm font-medium text-foreground">{getPriceSummary(product)}</p>
              <p className="text-xs text-muted-foreground">
                {product.location} • {formatTimeAgo(product.postedAt)}
              </p>
            </div>
          </Link>
        </article>
      ))}
    </div>
  );
}
