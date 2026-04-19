import type { Metadata } from 'next';
import { FooterInfoPage } from '@/components/marketplace/FooterInfoPage';
import { getFooterPage, getFooterPageMetadata } from '@/lib/footer-pages';

export const metadata: Metadata = getFooterPageMetadata('report-a-concern');

const page = getFooterPage('report-a-concern');

export default function ReportAConcernPage() {
  return <FooterInfoPage page={page} />;
}
