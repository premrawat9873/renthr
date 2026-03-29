'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { MOCK_PRODUCTS, CATEGORIES } from '@/data/mockData';
import { formatPrice, RentDuration } from '@/data/marketplaceData';
import Footer from '@/components/marketplace/Footer';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectIsWishlisted, toggleWishlist } from '@/store/slices/wishlistSlice';
import {
  ArrowLeft,
  MapPin,
  Star,
  Shield,
  Clock,
  Grid3X3,
  Heart,
  Share2,
  ChevronLeft,
  ChevronRight,
  X,
  Menu,
  CheckCircle2,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

const DURATION_LABELS: Record<RentDuration, { label: string; short: string }> = {
  hourly: { label: 'Hourly', short: '/hr' },
  daily: { label: 'Daily', short: '/day' },
  weekly: { label: 'Weekly', short: '/wk' },
  monthly: { label: 'Monthly', short: '/mo' },
};

const PRODUCT_TOP_TABS = [
  'Cars',
  'Motorcycles',
  'Mobile Phones',
  'For Sale: Houses & Apartments',
  'For Rent: Houses & Apartments',
  'Beds-Wardrobes',
  'TVs, Video - Audio',
];

function GalleryModal({
  open,
  onClose,
  images,
  initialIndex,
  alt,
}: {
  open: boolean;
  onClose: () => void;
  images: string[];
  initialIndex: number;
  alt: string;
}) {
  const [index, setIndex] = useState(initialIndex);

  const next = useCallback(() => setIndex((prev) => (prev + 1) % images.length), [images.length]);
  const prev = useCallback(
    () => setIndex((prev) => (prev - 1 + images.length) % images.length),
    [images.length]
  );

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') prev();
      if (event.key === 'ArrowRight') next();
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, prev, next, onClose]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-5xl bg-black/95 border-none text-white p-0 overflow-hidden">
        <div className="relative aspect-video w-full">
          <Image
            src={images[index]}
            alt={`${alt} ${index + 1}`}
            fill
            sizes="100vw"
            className="object-contain"
            priority
          />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 h-10 w-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center hover:bg-black/70"
            aria-label="Close gallery"
          >
            <X className="h-5 w-5" />
          </button>
          {images.length > 1 && (
            <>
              <button
                onClick={prev}
                className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center hover:bg-black/70"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={next}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center hover:bg-black/70"
                aria-label="Next image"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
        <div className="flex items-center justify-center gap-2 bg-black/70 px-4 py-3">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`h-2.5 rounded-full transition-all duration-200 ${
                i === index ? 'w-6 bg-white' : 'w-2 bg-white/40'
              }`}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ProductDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const product = MOCK_PRODUCTS.find((p) => p.id === id);
  const liked = useAppSelector((state) => selectIsWishlisted(state, id));

  const [selectedDuration, setSelectedDuration] = useState<RentDuration>('daily');
  const [quantity, setQuantity] = useState(1);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <h2 className="font-heading text-xl font-medium">Product not found</h2>
          <button onClick={() => router.push('/home')} className="text-primary text-sm hover:underline">
            Back to marketplace
          </button>
        </div>
      </div>
    );
  }

  const images = product.images.length > 0 ? product.images : [product.image];
  const availableDurations =
    product.type === 'rent' && product.rentPrices
      ? (Object.entries(product.rentPrices) as [RentDuration, number | null][]) // safe by model
          .filter(([, v]) => v != null)
          .map(([k]) => k)
      : [];

  const currentPrice =
    product.type === 'rent' && product.rentPrices
      ? product.rentPrices[selectedDuration]
      : product.price;

  const totalPrice = currentPrice ? currentPrice * quantity : null;
  const extraCount = images.length > 5 ? images.length - 5 : 0;
  const categoryLabel = CATEGORIES.find((c) => c.id === product.category)?.label ?? 'Marketplace';
  const today = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date());
  const breadcrumbs = ['Home', categoryLabel, product.location, product.title];

  const openGallery = (index: number) => {
    setGalleryIndex(index);
    setGalleryOpen(true);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-30 bg-accent/90 backdrop-blur-sm border-b border-primary/20 shadow-[0_6px_18px_-16px_hsl(var(--primary)/0.6)]">
        <div className="container flex items-center justify-between h-14">
          <button
            onClick={() => router.push('/home')}
            className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-1.5 text-sm font-medium hover:text-primary transition-colors">
              <Share2 className="h-4 w-4" /> Share
            </button>
            <button
              onClick={() => dispatch(toggleWishlist(id))}
              className="flex items-center gap-1.5 text-sm font-medium hover:text-primary transition-colors"
            >
              <Heart
                className={`h-4 w-4 transition-all ${liked ? 'fill-destructive text-destructive' : ''}`}
              />{' '}
              Save
            </button>
          </div>
        </div>
      </header>

      <section className="border-b border-border/60 bg-card/80">
        <div className="container py-3 space-y-2">
          <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground shadow-sm">
              <Menu className="h-4 w-4" />
              All Categories
            </button>
            {PRODUCT_TOP_TABS.map((item) => (
              <button
                key={item}
                className="inline-flex shrink-0 items-center rounded-full border border-border/60 bg-background px-4 py-2 text-sm text-foreground/90 transition-colors duration-200 hover:border-primary/30 hover:text-primary"
              >
                {item}
              </button>
            ))}
            <span className="ml-auto shrink-0 border-l border-border/60 pl-3 text-sm text-muted-foreground">
              {today}
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto text-xs sm:text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {breadcrumbs.map((item, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <div key={item} className="flex items-center gap-2 shrink-0">
                  <span className={isLast ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                    {item}
                  </span>
                  {!isLast && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <main className="container py-6 space-y-8 flex-1">
        <h1 className="font-heading text-2xl font-semibold">{product.title}</h1>

        <div className="relative">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 rounded-2xl overflow-hidden max-h-[420px]">
            <div
              className="md:col-span-2 md:row-span-2 relative cursor-pointer min-h-[260px] md:min-h-full"
              onClick={() => openGallery(0)}
            >
              <Image
                src={images[0]}
                alt={product.title}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover hover:brightness-95 transition-all duration-200"
              />
            </div>
            {images.slice(1, 5).map((src, i) => (
              <div
                key={i}
                className="hidden md:block relative cursor-pointer min-h-[206px]"
                onClick={() => openGallery(i + 1)}
              >
                <Image
                  src={src}
                  alt={`${product.title} ${i + 2}`}
                  fill
                  sizes="25vw"
                  className="object-cover hover:brightness-95 transition-all duration-200"
                />
                {i === 3 && extraCount > 0 && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="text-white text-2xl font-semibold">+{extraCount}</span>
                  </div>
                )}
              </div>
            ))}
            {images.length > 1 && (
              <button
                onClick={() => openGallery(0)}
                className="absolute bottom-4 right-4 bg-card text-foreground px-4 py-2 rounded-xl text-sm font-medium shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
              >
                <Grid3X3 className="h-4 w-4" />
                Show all photos
              </button>
            )}
          </div>
        </div>

        <GalleryModal
          key={galleryOpen ? `open-${galleryIndex}` : 'closed'}
          open={galleryOpen}
          onClose={() => setGalleryOpen(false)}
          images={images}
          initialIndex={galleryIndex}
          alt={product.title}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-8">
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-primary" />
                  {product.location} · {product.distance} km away
                </span>
                {product.rating != null && (
                  <span className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-star text-star" />
                    <span className="font-medium text-foreground">{product.rating}</span>
                    {product.reviewCount != null && (
                      <span>({product.reviewCount} reviews)</span>
                    )}
                  </span>
                )}
              </div>
              <div className="border-t border-border/40" />
            </div>

            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                {product.ownerImage ? (
                  <Image
                    src={product.ownerImage}
                    alt={product.ownerName}
                    width={48}
                    height={48}
                    className="h-12 w-12 object-cover"
                  />
                ) : (
                  <span className="text-lg font-medium text-muted-foreground">
                    {(product.ownerName || 'U')[0]}
                  </span>
                )}
              </div>
              <div>
                <p className="font-medium text-foreground">Listed by {product.ownerName || 'User'}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5 text-primary" />
                  {product.ownerTag || 'Verified Seller'}
                </p>
              </div>
            </div>

            <div className="border-t border-border/40" />

            <div className="space-y-3">
              <h2 className="font-heading text-lg font-medium">About this listing</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {product.description ||
                  `This ${
                    product.type === 'rent' ? 'rental' : 'sale'
                  } listing is available in ${product.location}. Contact the ${
                    product.type === 'rent' ? 'owner' : 'seller'
                  } for more details about the product condition and availability.`}
              </p>
            </div>

            <div className="border-t border-border/40" />

            {product.features && product.features.length > 0 && (
              <>
                <div className="space-y-4">
                  <h2 className="font-heading text-lg font-medium">What this offers</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {product.features.map((f, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm text-foreground">
                        <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border-t border-border/40" />
              </>
            )}

            <div className="space-y-3">
              <h2 className="font-heading text-lg font-medium">Location</h2>
              <div className="h-[200px] rounded-2xl bg-muted/40 flex items-center justify-center">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {product.location} — Map coming soon
                </span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-20 bg-card rounded-2xl border border-border/40 shadow-lg p-6 space-y-5">
              {product.type === 'sell' && product.price != null && (
                <div>
                  <span className="text-2xl font-semibold">{formatPrice(product.price)}</span>
                </div>
              )}

              {product.type === 'rent' && product.rentPrices && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {availableDurations.map((d) => (
                      <button
                        key={d}
                        onClick={() => setSelectedDuration(d)}
                        className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border ${
                          selectedDuration === d
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border/60 text-muted-foreground hover:border-foreground/30'
                        }`}
                      >
                        <div className="text-xs text-muted-foreground">{DURATION_LABELS[d].label}</div>
                        <div className="font-semibold text-foreground">
                          {formatPrice(product.rentPrices![d]!)}
                          {DURATION_LABELS[d].short}
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="border border-border/60 rounded-xl p-3">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Duration</div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">
                        {quantity} {DURATION_LABELS[selectedDuration].label.toLowerCase()}
                        {quantity > 1 ? 's' : ''}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setQuantity(Math.max(1, quantity - 1))}
                          className="h-7 w-7 rounded-full border border-border/60 flex items-center justify-center text-sm hover:bg-muted transition-colors"
                        >
                          −
                        </button>
                        <span className="text-sm font-medium w-4 text-center">{quantity}</span>
                        <button
                          onClick={() => setQuantity(quantity + 1)}
                          className="h-7 w-7 rounded-full border border-border/60 flex items-center justify-center text-sm hover:bg-muted transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {totalPrice != null && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {formatPrice(currentPrice!)} × {quantity}{' '}
                        {DURATION_LABELS[selectedDuration].label.toLowerCase()}
                        {quantity > 1 ? 's' : ''}
                      </span>
                      <span className="font-semibold">{formatPrice(totalPrice)}</span>
                    </div>
                  )}
                </>
              )}

              <div className="border-t border-border/40" />

              <button className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-medium text-base hover:bg-primary/90 hover:shadow-md transition-all duration-200 active:scale-[0.98]">
                {product.type === 'rent' ? 'Request to book' : 'Contact seller'}
              </button>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Response time: within a few hours
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4 text-primary" />
                Buyer protection and support included
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default ProductDetailClient;
