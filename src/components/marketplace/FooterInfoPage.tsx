import Link from 'next/link';
import type { FooterPageContent } from '@/lib/footer-pages';

export function FooterInfoPage({ page }: { page: FooterPageContent }) {
  return (
    <main className="bg-background">
      <div className="container max-w-4xl py-10 md:py-14">
        <p className="text-sm font-medium uppercase tracking-wide text-primary">{page.eyebrow}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          {page.title}
        </h1>
        <p className="mt-4 text-sm leading-7 text-muted-foreground md:text-base">
          {page.description}
        </p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground md:text-base">
          {page.sections.map((section) => (
            <section key={section.heading} className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground md:text-2xl">
                {section.heading}
              </h2>

              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}

              {section.bullets && section.bullets.length > 0 ? (
                <ul className="list-disc space-y-2 pl-6">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          Need legal details too? Read our{' '}
          <Link href="/privacy-policy" className="font-medium text-primary hover:underline">
            Privacy Policy
          </Link>{' '}
          and{' '}
          <Link href="/terms-of-use" className="font-medium text-primary hover:underline">
            Terms of Use
          </Link>
          .
        </div>
      </div>
    </main>
  );
}
