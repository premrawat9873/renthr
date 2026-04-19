import type { Metadata } from 'next';
import { FooterInfoPage } from '@/components/marketplace/FooterInfoPage';
import { getFooterPage, getFooterPageMetadata } from '@/lib/footer-pages';

export const metadata: Metadata = getFooterPageMetadata('seller-guidelines');

const page = getFooterPage('seller-guidelines');

export default function SellerGuidelinesPage() {
  return <FooterInfoPage page={page} />;
}
