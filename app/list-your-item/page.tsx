import type { Metadata } from 'next';
import { FooterInfoPage } from '@/components/marketplace/FooterInfoPage';
import { getFooterPage, getFooterPageMetadata } from '@/lib/footer-pages';

export const metadata: Metadata = getFooterPageMetadata('list-your-item');

const page = getFooterPage('list-your-item');

export default function ListYourItemPage() {
  return <FooterInfoPage page={page} />;
}
