import type { Metadata } from 'next';
import Link from 'next/link';
import { getSiteUrl, SITE_NAME } from '@/lib/site';

const LAST_UPDATED = '3 April 2026';
const SUPPORT_EMAIL = 'support@renthour.in';
const GRIEVANCE_EMAIL = 'grievance@renthour.in';
const LEGAL_ENTITY = 'RentHour Marketplace';
const OPERATOR_NAME = 'Prem Rawat';
const OPERATOR_REGION = 'Faridabad, Haryana, India';
const LEGAL_ADDRESS = 'B-51, Sector 50, Faridabad, Haryana 121001, India';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description:
    'Read the Terms of Use for RentHour Marketplace, including account rules, listing requirements, paid features, refunds, disputes, and legal rights.',
  alternates: {
    canonical: '/terms-of-use',
  },
  openGraph: {
    title: `Terms of Use | ${SITE_NAME}`,
    description:
      'The legal terms that govern access to and use of RentHour Marketplace services.',
    type: 'article',
    url: '/terms-of-use',
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

export default function TermsOfUsePage() {
  const siteUrl = getSiteUrl();

  const termsJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${SITE_NAME} Terms of Use`,
    url: `${siteUrl}/terms-of-use`,
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
          __html: JSON.stringify(termsJsonLd).replace(/</g, '\\u003c'),
        }}
      />

      <div className="container max-w-4xl py-10 md:py-14">
        <p className="text-sm font-medium uppercase tracking-wide text-primary">Legal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Terms of Use
        </h1>
        <p className="mt-3 text-sm text-muted-foreground md:text-base">
          Last updated: {LAST_UPDATED}
        </p>
        <p className="mt-4 text-sm leading-7 text-muted-foreground md:text-base">
          These Terms of Use (Terms) govern your access to and use of {SITE_NAME}, including our
          websites, apps, listings, chat tools, paid features, and related services
          (collectively, Services). By creating an account, posting listings, buying, renting,
          messaging, or otherwise using the Services, you agree to these Terms.
        </p>

        <nav aria-label="Terms contents" className="mt-8 rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-semibold text-foreground">Contents</p>
          <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><a href="#acceptance" className="hover:text-primary">1. Acceptance of Terms</a></li>
            <li><a href="#eligibility" className="hover:text-primary">2. Eligibility and Account Registration</a></li>
            <li><a href="#platform-role" className="hover:text-primary">3. Platform Role and Intermediary Status</a></li>
            <li><a href="#listings" className="hover:text-primary">4. Listings, Advertising, and User Commitments</a></li>
            <li><a href="#conduct" className="hover:text-primary">5. Prohibited Conduct</a></li>
            <li><a href="#paid-services" className="hover:text-primary">6. Paid Services, Billing, and Refunds</a></li>
            <li><a href="#third-party" className="hover:text-primary">7. Third-Party Services and Links</a></li>
            <li><a href="#ip" className="hover:text-primary">8. Intellectual Property</a></li>
            <li><a href="#user-content" className="hover:text-primary">9. User Content and License to Us</a></li>
            <li><a href="#privacy" className="hover:text-primary">10. Privacy and Data Use</a></li>
            <li><a href="#disclaimer" className="hover:text-primary">11. Disclaimer of Warranties</a></li>
            <li><a href="#liability" className="hover:text-primary">12. Limitation of Liability</a></li>
            <li><a href="#indemnity" className="hover:text-primary">13. Indemnity</a></li>
            <li><a href="#termination" className="hover:text-primary">14. Suspension and Termination</a></li>
            <li><a href="#law" className="hover:text-primary">15. Governing Law and Dispute Resolution</a></li>
            <li><a href="#changes" className="hover:text-primary">16. Changes to These Terms</a></li>
            <li><a href="#contact" className="hover:text-primary">17. Customer Care and Grievance Contact</a></li>
          </ol>
        </nav>

        <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground md:text-base">
          <section className="space-y-3">
            <SectionHeading id="acceptance">1. Acceptance of Terms</SectionHeading>
            <p>
              You must read and accept these Terms before using our Services. If you do not agree,
              do not use the Services. Your continued use after updates means you accept the updated
              Terms to the extent permitted by law.
            </p>
          </section>

          <section className="space-y-3">
            <SectionHeading id="eligibility">2. Eligibility and Account Registration</SectionHeading>
            <ul className="list-disc space-y-2 pl-6">
              <li>You must be at least 18 years old, or the age of majority under applicable law.</li>
              <li>You must provide accurate, complete, and current account information.</li>
              <li>You are responsible for account security and all activity under your account.</li>
              <li>
                We may require OTP or other verification for login, posting, paid features, fraud
                prevention, or compliance purposes.
              </li>
              <li>
                You must immediately notify us if you suspect unauthorized access to your account.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <SectionHeading id="platform-role">3. Platform Role and Intermediary Status</SectionHeading>
            <p>
              {SITE_NAME} is an online marketplace and technology intermediary. We do not own,
              possess, inspect, certify, broker, or guarantee listed goods or services unless
              explicitly stated for a specific feature. Transactions are generally between users,
              and users remain responsible for due diligence, compliance, and contractual outcomes.
            </p>
            <p>
              We do not act as an agent, broker, or insurer for any user or transaction.
            </p>
            <h3 className="text-base font-semibold text-foreground">Offline Transactions</h3>
            <p>
              {SITE_NAME}{' '}does not participate in, control, or guarantee offline transactions.
              Any agreement, exchange, payment, handover, delivery, or in-person interaction
              between users happens solely at users&apos; own risk.
            </p>
            <h3 className="text-base font-semibold text-foreground">User Identity Disclaimer</h3>
            <p>
              We do not guarantee the identity, authenticity, or reliability of any user, even
              where optional verification or KYC features are used.
            </p>
            <h3 className="text-base font-semibold text-foreground">Rental Risk and Responsibility</h3>
            <p>
              Renting items involves risk, including damage, loss, theft, misuse, delay, or
              non-return. {SITE_NAME} is not responsible for such incidents. Users are solely
              responsible for setting rental terms, collecting deposits, verifying counterparties,
              inspecting items, and managing safe handover and return.
            </p>
          </section>

          <section className="space-y-3">
            <SectionHeading id="listings">4. Listings, Advertising, and User Commitments</SectionHeading>
            <p>When posting listings or advertisements, you agree that:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                you have all rights, licenses, consents, and legal authority required to post the
                content and offer the listed item or service;
              </li>
              <li>
                listing details are truthful and not misleading, including photos, pricing,
                ownership claims, and service descriptions;
              </li>
              <li>
                you will comply with all applicable laws, regulations, permits, tax obligations,
                and category-specific requirements;
              </li>
              <li>
                you understand we may moderate, de-rank, restrict, or remove listings that violate
                these Terms, legal requirements, or platform safety standards.
              </li>
            </ul>
            <p>
              Buyers and renters should independently verify identity, ownership, condition,
              documentation, legal clearances, and suitability of listed items before paying or
              transacting.
            </p>
            <h3 className="text-base font-semibold text-foreground">Safety Tips</h3>
            <p>
              Users are encouraged to meet in public places, verify documents before payment,
              avoid advance transfers to unknown users, and follow safe transaction practices.
            </p>
          </section>

          <section className="space-y-3">
            <SectionHeading id="conduct">5. Prohibited Conduct</SectionHeading>
            <p>You must not use the Services to:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>post unlawful, deceptive, fraudulent, or rights-infringing content;</li>
              <li>
                list illegal, stolen, hazardous, or restricted items, including weapons, narcotics,
                counterfeit goods, or any item prohibited under applicable law;
              </li>
              <li>harass, threaten, exploit, impersonate, or abuse any person or group;</li>
              <li>publish malware, spam, phishing, or unauthorized commercial solicitation;</li>
              <li>manipulate listings, reviews, ranking, or pricing through unfair means;</li>
              <li>
                scrape or access our systems through bots, crawlers, automated posting tools, or
                unauthorized technical methods;
              </li>
              <li>
                upload content that violates intellectual property, privacy, publicity, or
                confidentiality rights.
              </li>
            </ul>
            <h3 className="text-base font-semibold text-foreground">Platform Abuse and Fraud Control</h3>
            <p>
              We reserve the right to investigate suspected fraud, abuse, policy evasion, or other
              harmful activity. We may warn users, limit visibility, suspend or block accounts,
              remove content, and share information with law enforcement or regulators where
              required by law.
            </p>
          </section>

          <section className="space-y-3">
            <SectionHeading id="paid-services">6. Paid Services, Billing, and Refunds</SectionHeading>
            <p>
              We may provide paid features such as boosted visibility, highlighted listings,
              response packages, premium badges, or other subscriptions. If you purchase paid
              features, the following applies:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                prices, feature scope, validity period, and limits are shown at checkout and may
                vary by category, location, or product type;
              </li>
              <li>
                unless explicitly stated, paid features improve visibility but do not guarantee
                responses, sales, rentals, or transaction completion;
              </li>
              <li>
                billing may be processed by approved third-party payment partners and may include
                applicable taxes;
              </li>
              <li>
                unused duration or partially consumed paid plans are generally non-refundable unless
                required by law or specifically promised in a plan policy;
              </li>
              <li>
                we may modify, suspend, or discontinue paid features with reasonable notice where
                practicable.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <SectionHeading id="third-party">7. Third-Party Services and Links</SectionHeading>
            <p>
              The Services may contain third-party links, payment gateways, logistics providers,
              map providers, partner offers, or external integrations. Your use of third-party
              services is governed by their terms and policies. We are not responsible for third-
              party service quality, availability, or outcomes.
            </p>
          </section>

          <section className="space-y-3">
            <SectionHeading id="ip">8. Intellectual Property</SectionHeading>
            <p>
              The platform interface, design, software, text, graphics, logos, trademarks, and
              other platform materials are owned by us or our licensors and protected by law. Except
              for limited personal use allowed by these Terms, you may not copy, redistribute,
              license, reverse engineer, or exploit platform materials without prior written
              permission.
            </p>
          </section>

          <section className="space-y-3">
            <SectionHeading id="user-content">9. User Content and License to Us</SectionHeading>
            <p>
              You retain ownership of your content. However, by posting or uploading content, you
              grant us a non-exclusive, worldwide, royalty-free, sublicensable license to host,
              store, reproduce, adapt, publish, display, distribute, and process that content for
              operating, improving, promoting, and securing the Services.
            </p>
            <p>
              We may remove or restrict access to content that appears unlawful, unsafe, fraudulent,
              infringing, or non-compliant with these Terms.
            </p>
          </section>

          <section className="space-y-3">
            <SectionHeading id="privacy">10. Privacy and Data Use</SectionHeading>
            <p>
              Your use of the Services is also governed by our{' '}
              <Link href="/privacy-policy" className="font-medium text-primary hover:underline">
                Privacy Policy
              </Link>
              , which explains how we collect, use, share, and protect personal data.
            </p>
          </section>

          <section className="space-y-3">
            <SectionHeading id="disclaimer">11. Disclaimer of Warranties</SectionHeading>
            <p>
              To the maximum extent permitted by law, the Services are provided on an as-is and as-
              available basis. We do not warrant uninterrupted availability, error-free operation,
              or guaranteed transaction outcomes. You are responsible for independent verification,
              due diligence, and safe transaction practices.
            </p>
            <p>
              We are not liable for delay, interruption, or failure of Services caused by events
              beyond our reasonable control, including natural disasters, internet or power outages,
              cyber incidents, strikes, war, government action, or payment/network failures.
            </p>
          </section>

          <section className="space-y-3">
            <SectionHeading id="liability">12. Limitation of Liability</SectionHeading>
            <p>
              To the extent permitted by law, we will not be liable for indirect, incidental,
              special, consequential, punitive, or exemplary damages, including loss of profits,
              goodwill, data, or business opportunity arising from your use of, or inability to use,
              the Services. Nothing in these Terms limits liability where such limitation is
              prohibited by applicable law.
            </p>
          </section>

          <section className="space-y-3">
            <SectionHeading id="indemnity">13. Indemnity</SectionHeading>
            <p>
              You agree to defend, indemnify, and hold us and our affiliates, officers, employees,
              and partners harmless from claims, losses, liabilities, costs, and expenses (including
              reasonable legal fees) arising out of your content, your listings, your transactions,
              your legal non-compliance, or your breach of these Terms.
            </p>
          </section>

          <section className="space-y-3">
            <SectionHeading id="termination">14. Suspension and Termination</SectionHeading>
            <p>
              We may suspend, restrict, or terminate access to all or part of the Services at our
              discretion where we reasonably believe there is policy abuse, fraud risk, legal risk,
              rights infringement, or other harmful activity. You may stop using the Services at any
              time.
            </p>
          </section>

          <section className="space-y-3">
            <SectionHeading id="law">15. Governing Law and Dispute Resolution</SectionHeading>
            <p>
              Unless mandatory law in your jurisdiction provides otherwise, these Terms are governed
              by the laws of India. Parties should first attempt good-faith resolution through
              written notice and discussions. If unresolved, disputes may be referred to arbitration
              in Gurugram, Haryana, in English, under the Arbitration and Conciliation Act, 1996.
              Subject to applicable law and arbitration requirements, courts at Gurugram, Haryana
              will have jurisdiction.
            </p>
          </section>

          <section className="space-y-3">
            <SectionHeading id="changes">16. Changes to These Terms</SectionHeading>
            <p>
              We may update these Terms from time to time to reflect product updates, legal
              requirements, or risk controls. Material changes will be notified by appropriate means,
              such as website notice, app notice, or email where feasible.
            </p>
          </section>

          <section className="space-y-3">
            <SectionHeading id="contact">17. Customer Care and Grievance Contact</SectionHeading>
            <p>
              For account, listing, payment, or support issues, contact:{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-primary hover:underline">
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
            <p>
              For legal notices or grievance matters, contact:{' '}
              <a href={`mailto:${GRIEVANCE_EMAIL}`} className="font-medium text-primary hover:underline">
                {GRIEVANCE_EMAIL}
              </a>
              .
            </p>
            <p>Legal identity: {LEGAL_ENTITY}</p>
            <p>Operated by {OPERATOR_NAME}</p>
            <p>{OPERATOR_REGION}</p>
            <p>Mailing address: {LEGAL_ADDRESS}</p>
            <p>
              Related legal page:{' '}
              <Link href="/privacy-policy" className="font-medium text-primary hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
