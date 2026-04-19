import type { Metadata } from 'next';
import { FooterInfoPage } from '@/components/marketplace/FooterInfoPage';
import { getFooterPage, getFooterPageMetadata } from '@/lib/footer-pages';

export const metadata: Metadata = getFooterPageMetadata('about-us');

const page = getFooterPage('about-us');

export default function AboutUsPage() {
  return <FooterInfoPage page={page} />;
}
