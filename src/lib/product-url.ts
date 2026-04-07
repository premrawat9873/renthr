type ProductSeoUrlInput = {
  id: string;
  title: string;
  category: string;
  location: string;
};

const MAX_SEGMENT_LENGTH = 60;

function toAsciiSlug(value: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  if (!normalized) {
    return "item";
  }

  return normalized.slice(0, MAX_SEGMENT_LENGTH).replace(/-+$/g, "") || "item";
}

export function parseProductIdFromRouteParam(param: string) {
  const normalized = param.trim();
  if (!normalized) {
    return null;
  }

  if (/^\d+$/.test(normalized)) {
    return normalized;
  }

  const iidMatch = normalized.match(/(?:^|-)iid-(\d+)$/i);
  if (iidMatch?.[1]) {
    return iidMatch[1];
  }

  return null;
}

export function getProductSeoSlug(input: ProductSeoUrlInput) {
  const categoryPart = toAsciiSlug(input.category);
  const titlePart = toAsciiSlug(input.title);
  const locationPart = toAsciiSlug(input.location);
  const idPart = input.id.trim();

  return `${categoryPart}-${titlePart}-in-${locationPart}-iid-${idPart}`;
}

export function getProductHref(input: ProductSeoUrlInput) {
  return `/product/${getProductSeoSlug(input)}`;
}
