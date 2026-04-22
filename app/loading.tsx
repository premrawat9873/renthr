export default function GlobalLoading() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4">
          <div className="inline-flex items-center gap-2" aria-label="renthour loading">
            <span className="font-heading text-[2rem] font-semibold leading-none tracking-[-0.03em] text-foreground sm:text-[2.25rem]">
              rent
            </span>
            <span className="rounded-xl bg-[#d4e3d8] px-3 py-1 font-heading text-[2rem] font-semibold leading-none tracking-[-0.03em] text-[#2f5f52] sm:text-[2.25rem]">
              hour
            </span>
          </div>

          <p className="text-sm font-medium text-muted-foreground">Loading...</p>
        </div>
      </div>
    </main>
  );
}
