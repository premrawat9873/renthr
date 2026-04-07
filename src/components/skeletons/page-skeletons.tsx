import { Skeleton } from '@/components/ui/skeleton';

function ListingCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-card">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="space-y-2.5 p-4">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3.5 w-2/5" />
        <div className="pt-1">
          <Skeleton className="h-5 w-1/3" />
        </div>
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
    </div>
  );
}

export function MarketplacePageLoadingSkeleton() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="container space-y-6 py-8">
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={`chip-${index}`} className="h-8 w-20 rounded-full" />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <ListingCardSkeleton key={`listing-card-${index}`} />
          ))}
        </div>

        <div className="flex justify-center">
          <Skeleton className="h-11 w-36 rounded-full" />
        </div>
      </div>
    </main>
  );
}

export function MyPostsPageLoadingSkeleton() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="container space-y-6 py-10">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <ListingCardSkeleton key={`my-post-card-${index}`} />
          ))}
        </div>
      </div>
    </main>
  );
}

export function MessagesPageLoadingSkeleton() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="container py-6">
        <div className="grid h-[calc(100vh-7rem)] grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
          <section className="rounded-2xl border border-border/55 bg-card p-4">
            <div className="space-y-4">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-9 w-full rounded-lg" />
              <div className="space-y-3">
                {Array.from({ length: 7 }).map((_, index) => (
                  <div key={`chat-list-${index}`} className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-2/3" />
                      <Skeleton className="h-3 w-5/6" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="flex flex-col rounded-2xl border border-border/55 bg-card">
            <div className="border-b border-border/60 p-4">
              <Skeleton className="h-5 w-48" />
            </div>
            <div className="flex-1 space-y-4 p-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={`chat-bubble-${index}`}
                  className={index % 2 === 0 ? 'flex justify-start' : 'flex justify-end'}
                >
                  <Skeleton
                    className={`h-10 rounded-2xl ${index % 2 === 0 ? 'w-44' : 'w-56'}`}
                  />
                </div>
              ))}
            </div>
            <div className="border-t border-border/60 p-4">
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export function ProfileDashboardLoadingSkeleton() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/75 backdrop-blur-md">
        <div className="mx-auto flex h-[62px] max-w-6xl items-center justify-between px-4 sm:px-6">
          <Skeleton className="h-9 w-32 rounded-lg" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-20 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-7 sm:px-6 sm:py-9">
        <section className="rounded-[1.35rem] border border-border/55 bg-card p-5 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
            <div className="flex items-center gap-5">
              <Skeleton className="h-28 w-28 rounded-full" />
              <div className="space-y-3">
                <Skeleton className="h-8 w-56" />
                <Skeleton className="h-5 w-28 rounded-full" />
                <Skeleton className="h-4 w-44" />
              </div>
            </div>

            <div className="grid flex-1 grid-cols-3 gap-3 lg:ml-auto">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={`profile-stat-${index}`} className="rounded-2xl border border-border/50 p-4">
                  <Skeleton className="h-5 w-12" />
                  <Skeleton className="mt-3 h-6 w-16" />
                  <Skeleton className="mt-2 h-3 w-20" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={`profile-tab-${index}`} className="h-10 w-28 rounded-xl" />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <ListingCardSkeleton key={`profile-listing-${index}`} />
          ))}
        </div>
      </div>
    </main>
  );
}

export function PublicProfileLoadingSkeleton() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/75 backdrop-blur-md">
        <div className="mx-auto flex h-[62px] max-w-6xl items-center justify-between px-4 sm:px-6">
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </header>

      <div className="container space-y-8 py-10">
        <section className="rounded-[1.35rem] border border-border/55 bg-card p-5 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
            <div className="flex items-center gap-5">
              <Skeleton className="h-[88px] w-[88px] rounded-2xl" />
              <div className="space-y-3">
                <Skeleton className="h-8 w-52" />
                <Skeleton className="h-5 w-28 rounded-full" />
                <Skeleton className="h-4 w-36" />
              </div>
            </div>

            <div className="grid flex-1 grid-cols-3 gap-3 lg:ml-auto">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={`public-stat-${index}`} className="rounded-2xl border border-border/50 p-4">
                  <Skeleton className="h-5 w-12" />
                  <Skeleton className="mt-3 h-6 w-16" />
                  <Skeleton className="mt-2 h-3 w-20" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <Skeleton className="h-6 w-28" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <ListingCardSkeleton key={`public-post-${index}`} />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <Skeleton className="h-6 w-36" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`review-skeleton-${index}`} className="rounded-2xl border border-border/50 bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-12 rounded-full" />
                </div>
                <Skeleton className="mt-3 h-14 w-full" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

export function ProductDetailLoadingSkeleton() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="container space-y-6 py-6 md:py-8">
        <Skeleton className="h-5 w-36" />

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-3">
            <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={`thumb-${index}`} className="h-20 rounded-xl" />
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-9 w-4/5" />
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
            <div className="space-y-2 pt-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Skeleton className="h-11 rounded-xl" />
              <Skeleton className="h-11 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export function LegalDocumentLoadingSkeleton() {
  return (
    <main className="bg-background">
      <div className="container max-w-4xl space-y-8 py-10 md:py-14">
        <div className="space-y-3">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-full" />
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <Skeleton className="h-4 w-24" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 10 }).map((_, index) => (
              <Skeleton key={`toc-${index}`} className="h-3.5 w-3/4" />
            ))}
          </div>
        </div>

        <div className="space-y-8">
          {Array.from({ length: 6 }).map((_, sectionIndex) => (
            <section key={`legal-section-${sectionIndex}`} className="space-y-3">
              <Skeleton className="h-7 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

export function LoginPageLoadingSkeleton() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="container flex min-h-screen items-center justify-center py-10">
        <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
          <div className="space-y-3">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-3/4" />
          </div>

          <div className="mt-6 space-y-3">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>

          <div className="mt-5 space-y-2">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </main>
  );
}