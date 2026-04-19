import type { Metadata } from 'next';
import { FooterInfoPage } from '@/components/marketplace/FooterInfoPage';
import { getFooterPage, getFooterPageMetadata } from '@/lib/footer-pages';

export const metadata: Metadata = getFooterPageMetadata('help-centre');

const page = getFooterPage('help-centre');

export default function HelpCentrePage() {
  return <FooterInfoPage page={page} />;
}
