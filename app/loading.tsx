export default function RootLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="h-10 w-10 mx-auto rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        <p className="mt-4 text-sm text-muted-foreground">Loading marketplace...</p>
      </div>
    </div>
  );
}
