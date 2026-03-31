// Some browser environments or injected scripts can expose a partial
// Performance API without clearMarks/clearMeasures. Next client runtime
// calls both methods during hydration metrics, so guard them early.
(() => {
  try {
    if (typeof window === "undefined") {
      return;
    }

    const perf = window.performance as {
      clearMarks?: (markName?: string) => void;
      clearMeasures?: (measureName?: string) => void;
    } | null;

    if (!perf) {
      return;
    }

    if (typeof perf.clearMarks !== "function") {
      perf.clearMarks = () => {};
    }

    if (typeof perf.clearMeasures !== "function") {
      perf.clearMeasures = () => {};
    }
  } catch {
    // Never let instrumentation break app startup.
  }
})();