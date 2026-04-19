import type { Metadata } from 'next';
import { FooterInfoPage } from '@/components/marketplace/FooterInfoPage';
import { getFooterPage, getFooterPageMetadata } from '@/lib/footer-pages';

export const metadata: Metadata = getFooterPageMetadata('careers');

const page = getFooterPage('careers');

export default function CareersPage() {
  return <FooterInfoPage page={page} />;
}
