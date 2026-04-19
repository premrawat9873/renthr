import type { Metadata } from 'next';
import { FooterInfoPage } from '@/components/marketplace/FooterInfoPage';
import { getFooterPage, getFooterPageMetadata } from '@/lib/footer-pages';

export const metadata: Metadata = getFooterPageMetadata('cancellation-options');

const page = getFooterPage('cancellation-options');

export default function CancellationOptionsPage() {
  return <FooterInfoPage page={page} />;
}
