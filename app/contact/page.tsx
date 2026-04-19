import type { Metadata } from 'next';
import { FooterInfoPage } from '@/components/marketplace/FooterInfoPage';
import { getFooterPage, getFooterPageMetadata } from '@/lib/footer-pages';

export const metadata: Metadata = getFooterPageMetadata('contact');

const page = getFooterPage('contact');

export default function ContactPage() {
  return <FooterInfoPage page={page} />;
}
