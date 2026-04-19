import type { Metadata } from 'next';
import { FooterInfoPage } from '@/components/marketplace/FooterInfoPage';
import { getFooterPage, getFooterPageMetadata } from '@/lib/footer-pages';

export const metadata: Metadata = getFooterPageMetadata('safety-information');

const page = getFooterPage('safety-information');

export default function SafetyInformationPage() {
  return <FooterInfoPage page={page} />;
}
