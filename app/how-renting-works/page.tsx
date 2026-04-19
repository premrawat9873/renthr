import type { Metadata } from 'next';
import { FooterInfoPage } from '@/components/marketplace/FooterInfoPage';
import { getFooterPage, getFooterPageMetadata } from '@/lib/footer-pages';

export const metadata: Metadata = getFooterPageMetadata('how-renting-works');

const page = getFooterPage('how-renting-works');

export default function HowRentingWorksPage() {
  return <FooterInfoPage page={page} />;
}
