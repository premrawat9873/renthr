import type { Metadata } from 'next';
import Link from 'next/link';
import { getSiteUrl, SITE_NAME } from '@/lib/site';

const LAST_UPDATED = '3 April 2026';
const SUPPORT_EMAIL = 'privacy@renthour.in';
const SUPPORT_ADDRESS = 'Prem Rawat, B-51, Sector 50, Faridabad, Haryana 121001, India';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Read how RentHour Marketplace collects, uses, stores, and protects your personal data, and how you can exercise your privacy rights.',
  alternates: {
    canonical: '/privacy-policy',
  },
  openGraph: {
    title: `Privacy Policy | ${SITE_NAME}`,
    description:
      'Read how RentHour Marketplace collects, uses, stores, and protects your personal data.',
    type: 'article',
    url: '/privacy-policy',
  },
  robots: {
    index: true,
    follow: true,
  },
};

function SectionHeading({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="scroll-mt-24 text-xl font-semibold text-foreground md:text-2xl">
      {children}
    </h2>
  );
}

export default function PrivacyPolicyPage() {
  const siteUrl = getSiteUrl();

  const privacyJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${SITE_NAME} Privacy Policy`,
    url: `${siteUrl}/privacy-policy`,
    dateModified: '2026-04-03',
    inLanguage: 'en-IN',
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: siteUrl,
    },
  };

  return (
    <main className="bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(privacyJsonLd).replace(/</g, '\\u003c'),
        }}
      />

      <div className="container max-w-4xl py-10 md:py-14">
        <p className="text-sm font-medium uppercase tracking-wide text-primary">Legal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-muted-foreground md:text-base">
          Effective date: {LAST_UPDATED}
        </p>
        <p className="mt-4 text-sm leading-7 text-muted-foreground md:text-base">
          This Privacy Policy explains how {SITE_NAME} ("we", "our", "us") collects, uses,
          shares, and protects personal data when you use our website, apps, APIs, and related
          services (collectively, the "Services").
        </p>

        <nav aria-label="Privacy policy contents" className="mt-8 rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-semibold text-foreground">Contents</p>
          <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><a href="#who-we-are" className="hover:text-primary">1. Who we are</a></li>
            <li><a href="#scope" className="hover:text-primary">2. Scope of this policy</a></li>
            <li><a href="#data-we-collect" className="hover:text-primary">3. Data we collect</a></li>
            <li><a href="#why-we-process" className="hover:text-primary">4. Why we process your data</a></li>
            <li><a href="#legal-bases" className="hover:text-primary">5. Legal bases for processing</a></li>
            <li><a href="#sharing" className="hover:text-primary">6. Who we share data with</a></li>
            <li><a href="#international" className="hover:text-primary">7. International data transfers</a></li>
            <li><a href="#retention" className="hover:text-primary">8. Data retention</a></li>
            <li><a href="#security" className="hover:text-primary">9. Security measures</a></li>
            <li><a href="#rights" className="hover:text-primary">10. Your privacy rights</a></li>
            <li><a href="#cookies" className="hover:text-primary">11. Cookies and similar technologies</a></li>
            <li><a href="#children" className="hover:text-primary">12. Children&apos;s privacy</a></li>
            <li><a href="#changes" className="hover:text-primary">13. Changes to this policy</a></li>
            <li><a href="#contact" className="hover:text-primary">14. Contact us</a></li>
          </ol>
        </nav>

        <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground md:text-base">
          <section className="space-y-3">
            <SectionHeading id="who-we-are">1. Who we are</SectionHeading>
            <p>
              {SITE_NAME} is operated by <strong>Prem Rawat</strong>, based in{' '}
              <strong>Faridabad, Haryana, India</strong>, with office at{' '}
              <strong>B-51, Sector 50, Faridabad, Haryana 121001</strong>. We act as the data
              controller for personal data processed under this policy, except where we explicitly
              state that another party acts as an independent controller.
            </p>
            <p>
              For privacy matters, you can contact us at{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-primary hover:underline">
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </section>

          <section className="space-y-3">
            <SectionHeading id="scope">2. Scope of this policy</SectionHeading>
            <p>
              This policy applies when you browse listings, create an account, post or manage
              listings, message other users, purchase paid features, contact support, or otherwise
              interact with our Services.
            </p>
            <h3 className="text-base font-semibold text-foreground">Marketplace Disclaimer</h3>
            <p>
              We are a user-to-user marketplace platform. We do not own, inspect, guarantee, or
              complete transactions between users. We are not responsible for transaction outcomes,
              product quality, delivery failures, user-to-user disputes, or any direct or indirect
              damages arising from deals made through the Services.
            </p>
            <h3 className="text-base font-semibold text-foreground">User Responsibility</h3>
            <p>
              Users are responsible for verifying each other before any payment, rental, purchase,
              or handover. This includes verifying identity, listing accuracy, ownership,
              documentation, condition, and legitimacy of the transaction.
            </p>
            <h3 className="text-base font-semibold text-foreground">User Identity Disclaimer</h3>
            <p>
              We do not guarantee the identity, authenticity, or reliability of any user, even
              where optional verification or KYC features are used.
            </p>
          </section>

          <section className="space-y-3">
            <SectionHeading id="data-we-collect">3. Data we collect</SectionHeading>
            <p>Depending on your activity, we may collect the following categories of data:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                Account and identity data: name, email address, phone number, login credentials,
                account identifiers, and profile details.
              </li>
              <li>
                Listing and transaction data: listing title, description, category, images, pricing,
                location details, booking or purchase context, and related records.
              </li>
              <li>
                Communication data: messages sent via in-app chat, customer support requests, and
                related communication logs.
              </li>
              <li>
                Technical and usage data: IP address, browser type, device identifiers, app events,
                page views, interaction data, and approximate geolocation derived from technical
                signals.
              </li>
              <li>
                Payment and billing data: payment method metadata, billing records, invoices, and
                fraud-prevention signals. We do not store full card numbers.
              </li>
              <li>
                Optional verification data: documents or verification details if you choose optional
                account or listing verification features (where available).
              </li>
            </ul>
            <h3 className="text-base font-semibold text-foreground">Verification/KYC (optional)</h3>
            <p>
              Where available, you may voluntarily use verification/KYC features to improve trust
              and reduce fraud risk. This may include identity documents, selfie/live photo checks,
              or business verification details. We process this data only for verification,
              security, and compliance purposes.
            </p>
          </section>

          <section className="space-y-3">
            <SectionHeading id="why-we-process">4. Why we process your data</SectionHeading>
            <p>We use personal data to:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>create and manage user accounts, authentication, and security checks;</li>
              <li>publish, rank, and show listings relevant to your searches and location;</li>
              <li>enable user-to-user communication and transaction workflows;</li>
              <li>review reports and support dispute handling workflows;</li>
              <li>process payments, prevent fraud, and enforce platform policies;</li>
              <li>improve platform performance, reliability, and product features;</li>
              <li>send service notifications and, where permitted, marketing communications;</li>
              <li>comply with legal obligations and respond to valid legal requests.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <SectionHeading id="legal-bases">5. Legal bases for processing</SectionHeading>
            <p>
              Where applicable law requires a legal basis, we process personal data under one or
              more of the following grounds:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>performance of a contract with you;</li>
              <li>legitimate interests (for example, platform security and service improvement);</li>
              <li>your consent (for specific optional features and marketing where required);</li>
              <li>compliance with legal obligations.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <SectionHeading id="sharing">6. Who we share data with</SectionHeading>
            <p>We may share personal data with:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>service providers (hosting, analytics, communications, support, security);</li>
              <li>payment processors and anti-fraud partners;</li>
              <li>integration partners you choose to connect with (if any);</li>
              <li>group companies and affiliates where needed to operate our Services;</li>
              <li>authorities and regulators when required by law;</li>
              <li>
                potential acquirers or successors in business transfers, subject to appropriate
                confidentiality safeguards.
              </li>
            </ul>
            <p>
              We do not sell your personal data as a standalone data product. Where advertising or
              personalization technologies are used, they operate under the controls and disclosures
              described in this policy.
            </p>
          </section>

          <section className="space-y-3">
            <SectionHeading id="international">7. International data transfers</SectionHeading>
            <p>
              Your data may be processed outside your country. When we transfer data across borders,
              we use legally recognized safeguards such as contractual protections, access controls,
              and technical protections (including encryption and pseudonymisation where suitable).
            </p>
          </section>

          <section className="space-y-3">
            <SectionHeading id="retention">8. Data retention</SectionHeading>
            <p>
              We retain personal data only as long as needed for the purposes described in this
              policy, including legal, tax, fraud-prevention, audit, and dispute-resolution needs.
              Retention periods vary by data type and applicable obligations.
            </p>
          </section>

          <section className="space-y-3">
            <SectionHeading id="security">9. Security measures</SectionHeading>
            <p>
              We implement appropriate technical and organizational controls designed to protect
              personal data, including encryption in transit, restricted access, monitoring,
              incident response practices, and periodic security reviews.
            </p>
            <p>
              No internet transmission or storage system can be guaranteed 100% secure. We encourage
              you to protect your account credentials and notify us promptly about any suspected
              unauthorized access.
            </p>
          </section>

          <section className="space-y-3">
            <SectionHeading id="rights">10. Your privacy rights</SectionHeading>
            <p>Subject to your local law, you may have rights to:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>access personal data we hold about you;</li>
              <li>correct inaccurate or incomplete data;</li>
              <li>delete data in certain circumstances;</li>
              <li>object to or restrict certain processing;</li>
              <li>withdraw consent where processing is based on consent;</li>
              <li>request data portability where applicable;</li>
              <li>lodge a complaint with your local data protection authority.</li>
            </ul>
            <h3 className="text-base font-semibold text-foreground">Account Deletion and Data Removal</h3>
            <p>
              You can request account deletion and data removal by contacting us at{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-primary hover:underline">
                {SUPPORT_EMAIL}
              </a>
              . Where available, you may also use account settings to submit a deletion request.
            </p>
            <p>
              After verification of your request, we will deactivate your account and delete or
              anonymize personal data as required by applicable law. We may retain limited data for
              legal compliance, fraud prevention, safety, tax/accounting, and dispute records.
            </p>
            <p>
              To request deletion or exercise your rights, contact us at{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-primary hover:underline">
                {SUPPORT_EMAIL}
              </a>
              . We may need to verify your identity before fulfilling certain requests.
            </p>
          </section>

          <section className="space-y-3">
            <SectionHeading id="cookies">11. Cookies and similar technologies</SectionHeading>
            <p>
              We use cookies and related technologies for authentication, security, analytics,
              performance, and personalization. We and our third-party analytics and advertising
              partners may use cookies, pixels, and similar technologies to measure usage,
              understand campaign effectiveness, and improve relevance of content and ads.
            </p>
            <p>
              You can control cookies through browser settings and device controls. Disabling some
              cookies may impact site functionality.
            </p>
          </section>

          <section className="space-y-3">
            <SectionHeading id="children">12. Children&apos;s privacy</SectionHeading>
            <p>
              Our Services are not intended for children below the minimum age required by applicable
              law in your jurisdiction. We do not knowingly collect personal data from children who
              are not legally permitted to use the Services.
            </p>
          </section>

          <section className="space-y-3">
            <SectionHeading id="changes">13. Changes to this policy</SectionHeading>
            <p>
              We may update this Privacy Policy from time to time. If we make material changes, we
              will provide notice through the Services or by other appropriate means.
            </p>
          </section>

          <section className="space-y-3">
            <SectionHeading id="contact">14. Contact us</SectionHeading>
            <p>
              For privacy questions, requests, or complaints, contact us at{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-primary hover:underline">
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
            <h3 className="text-base font-semibold text-foreground">Dispute Handling</h3>
            <p>
              We may assist by reviewing reports, facilitating communication, or restricting
              accounts that violate our policies. However, we are not a party to user-to-user
              transactions and are not liable for losses, damages, or claims arising from disputes
              between users.
            </p>
            <p>Mailing address: {SUPPORT_ADDRESS}</p>
            <p>
              You can return to the marketplace at{' '}
              <Link href="/" className="font-medium text-primary hover:underline">
                /
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
