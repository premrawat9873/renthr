import type { Metadata } from 'next';
import { FooterInfoPage } from '@/components/marketplace/FooterInfoPage';
import { getFooterPage, getFooterPageMetadata } from '@/lib/footer-pages';

export const metadata: Metadata = getFooterPageMetadata('pricing-tips');

const page = getFooterPage('pricing-tips');

export default function PricingTipsPage() {
  return <FooterInfoPage page={page} />;
}
