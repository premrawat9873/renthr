import { useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";

interface Props {
  images: string[];
  alt: string;
  className?: string;
  priority?: boolean;
}

const CAROUSEL_IMAGE_QUALITY = 75;
const CAROUSEL_IMAGE_SIZES =
  "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw";

export default function ImageCarousel({ images, alt, className = "", priority = false }: Props) {
  const [current, setCurrent] = useState(0);
  const [hovered, setHovered] = useState(false);
  const total = images.length;
  const activeImage = images[Math.max(0, Math.min(current, total - 1))];

  const prev = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCurrent((c) => (c === 0 ? total - 1 : c - 1));
  }, [total]);

  const next = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCurrent((c) => (c === total - 1 ? 0 : c + 1));
  }, [total]);

  if (total <= 1) {
    return (
      <div className="relative w-full h-full">
        <Image
          src={images[0]}
          alt={alt}
          fill
          sizes={CAROUSEL_IMAGE_SIZES}
          quality={CAROUSEL_IMAGE_QUALITY}
          priority={priority}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          className={`object-contain transform-gpu transition-transform duration-500 ease-out group-hover:scale-[1.01] ${className}`}
        />
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Active image only (keeps cards lightweight on first load) */}
      <div className={`relative w-full h-full ${className}`}>
        <Image
          src={activeImage}
          alt={`${alt} ${current + 1}`}
          fill
          sizes={CAROUSEL_IMAGE_SIZES}
          quality={CAROUSEL_IMAGE_QUALITY}
          priority={priority}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          className="object-contain transform-gpu transition-transform duration-500 ease-out group-hover:scale-[1.01]"
        />
      </div>

      {/* Arrows - visible on hover */}
      {hovered && (
        <>
          <button
            onClick={prev}
            aria-label="Previous image"
            className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-card/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-card hover:shadow-md transition-all duration-200 z-10"
          >
            <ChevronLeft className="h-4 w-4 text-foreground" />
          </button>
          <button
            onClick={next}
            aria-label="Next image"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-card/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-card hover:shadow-md transition-all duration-200 z-10"
          >
            <ChevronRight className="h-4 w-4 text-foreground" />
          </button>
        </>
      )}

      {/* Dots */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 z-10">
        {images.map((_, i) => (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); setCurrent(i); }}
            aria-label={`Go to image ${i + 1}`}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full transition-all duration-200"
          >
            <span
              className={`rounded-full transition-all duration-200 ${
                i === current
                  ? "h-2 w-2 bg-card shadow-sm"
                  : "h-1.5 w-1.5 bg-card/60"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
