import type { Metadata } from 'next';
import { FooterInfoPage } from '@/components/marketplace/FooterInfoPage';
import { getFooterPage, getFooterPageMetadata } from '@/lib/footer-pages';

export const metadata: Metadata = getFooterPageMetadata('blog');

const page = getFooterPage('blog');

export default function BlogPage() {
  return <FooterInfoPage page={page} />;
}
