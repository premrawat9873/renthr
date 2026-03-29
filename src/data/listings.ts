import type { Product } from "@/data/marketplaceData";

export type ListingProductPayload = Omit<Product, "postedAt"> & {
  postedAt: string;
};

export function serializeListingProduct(product: Product): ListingProductPayload {
  return {
    ...product,
    postedAt: product.postedAt.toISOString(),
  };
}

export function deserializeListingProduct(payload: ListingProductPayload): Product {
  return {
    ...payload,
    postedAt: new Date(payload.postedAt),
  };
}
