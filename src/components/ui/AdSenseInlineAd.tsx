'use client';

import { useEffect, useRef, useState } from 'react';

type AdSenseWindow = Window & {
  adsbygoogle?: Array<Record<string, never>>;
};

const ADSENSE_CLIENT_ID = 'ca-pub-9411649869227225';

type AdSenseInlineAdProps = {
  adSlot: string;
  className?: string;
  adFormat?: 'auto' | 'fluid';
  adLayoutKey?: string;
  fullWidthResponsive?: boolean;
};

export default function AdSenseInlineAd({
  adSlot,
  className,
  adFormat = 'auto',
  adLayoutKey,
  fullWidthResponsive = true,
}: AdSenseInlineAdProps) {
  const adRef = useRef<HTMLModElement | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    const adElement = adRef.current;
    if (!adElement) {
      return;
    }

    // Avoid duplicate push calls for an already initialized ad node.
    if (adElement.getAttribute('data-adsbygoogle-status')) {
      return;
    }

    try {
      const adsWindow = window as AdSenseWindow;
      adsWindow.adsbygoogle = adsWindow.adsbygoogle || [];
      adsWindow.adsbygoogle.push({});
    } catch {
      // If AdSense is blocked/unavailable, fail silently without crashing UI.
    }
  }, [isMounted]);

  if (!isMounted) {
    return null;
  }

  return (
    <ins
      ref={adRef}
      className={['adsbygoogle', className].filter(Boolean).join(' ')}
      style={{ display: 'block' }}
      data-ad-client={ADSENSE_CLIENT_ID}
      data-ad-slot={adSlot}
      data-ad-format={adFormat}
      data-ad-layout-key={adLayoutKey}
      data-full-width-responsive={fullWidthResponsive ? 'true' : undefined}
    />
  );
}