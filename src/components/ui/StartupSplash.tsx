'use client';

import { useEffect, useState } from 'react';

export default function StartupSplash() {
  const [phase, setPhase] = useState<'enter' | 'exit' | 'hidden'>('enter');

  useEffect(() => {
    const showTimer = window.setTimeout(() => {
      setPhase('exit');
    }, 850);

    const hideTimer = window.setTimeout(() => {
      setPhase('hidden');
    }, 1250);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (phase === 'hidden') {
    return null;
  }

  const isExiting = phase === 'exit';

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-[120] flex items-center justify-center transition-opacity duration-300 ${
        isExiting ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,#e9f6ee_0%,#f5f7f2_50%,#edf1eb_100%)]" />
      <div
        className={`relative font-heading text-[2.6rem] font-semibold tracking-[-0.045em] text-[#1f5a45] transition-transform duration-300 sm:text-[3rem] ${
          isExiting ? 'scale-95' : 'scale-100'
        }`}
      >
        RentHour
      </div>
    </div>
  );
}
