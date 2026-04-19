import type { Metadata } from 'next';
import Link from 'next/link';
import {
  getFooterPage,
  getFooterPagePath,
  type FooterPageSlug,
} from '@/lib/footer-pages';

export const metadata: Metadata = {
  title: 'Sitemap',
  description: 'Browse all major RentHour pages, including support, listing resources, and company information.',
  alternates: {
    canonical: '/sitemap',
  },
  robots: {
    index: true,
    follow: true,
  },
};

const supportSlugs: FooterPageSlug[] = [
  'help-centre',
  'safety-information',
  'cancellation-options',
  'report-a-concern',
];

const listingSlugs: FooterPageSlug[] = [
  'list-your-item',
  'how-renting-works',
  'seller-guidelines',
  'pricing-tips',
];

const companySlugs: FooterPageSlug[] = ['about-us', 'careers', 'blog', 'contact'];

const coreLinks = [
  { href: '/', label: 'Home' },
  { href: '/product', label: 'Product Marketplace' },
  { href: '/search', label: 'Search' },
  { href: '/messages', label: 'Messages' },
  { href: '/profile', label: 'Profile' },
  { href: '/privacy-policy', label: 'Privacy Policy' },
  { href: '/terms-of-use', label: 'Terms of Use' },
  { href: '/sitemap.xml', label: 'XML Sitemap' },
];

function FooterSectionLinks({
  heading,
  slugs,
}: {
  heading: string;
  slugs: FooterPageSlug[];
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold text-foreground">{heading}</h2>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {slugs.map((slug) => {
          const page = getFooterPage(slug);
          return (
            <li key={slug}>
              <Link href={getFooterPagePath(slug)} className="hover:text-primary">
                {page.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function SitemapPage() {
  return (
    <main className="bg-background">
      <div className="container max-w-5xl py-10 md:py-14">
        <p className="text-sm font-medium uppercase tracking-wide text-primary">Navigation</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Sitemap
        </h1>
        <p className="mt-4 text-sm leading-7 text-muted-foreground md:text-base">
          Use this page to find every important area of RentHour.
        </p>

        <section className="mt-8 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold text-foreground">Core Pages</h2>
          <ul className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            {coreLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-primary">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <FooterSectionLinks heading="Support" slugs={supportSlugs} />
          <FooterSectionLinks heading="Listing" slugs={listingSlugs} />
          <FooterSectionLinks heading="Company" slugs={companySlugs} />
        </div>
      </div>
    </main>
  );
}
