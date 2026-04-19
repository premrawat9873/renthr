import type { Metadata } from 'next';
import { SITE_NAME } from '@/lib/site';

export type FooterPageSlug =
  | 'help-centre'
  | 'safety-information'
  | 'cancellation-options'
  | 'report-a-concern'
  | 'list-your-item'
  | 'how-renting-works'
  | 'seller-guidelines'
  | 'pricing-tips'
  | 'about-us'
  | 'careers'
  | 'blog'
  | 'contact';

export type FooterPageSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type FooterPageContent = {
  slug: FooterPageSlug;
  title: string;
  description: string;
  eyebrow: string;
  sections: FooterPageSection[];
};

export const footerPageOrder: FooterPageSlug[] = [
  'help-centre',
  'safety-information',
  'cancellation-options',
  'report-a-concern',
  'list-your-item',
  'how-renting-works',
  'seller-guidelines',
  'pricing-tips',
  'about-us',
  'careers',
  'blog',
  'contact',
];

const footerPages: Record<FooterPageSlug, FooterPageContent> = {
  'help-centre': {
    slug: 'help-centre',
    title: 'Help Centre',
    description:
      'Find answers for account setup, listing management, messages, bookings, and payments on RentHour.',
    eyebrow: 'Support',
    sections: [
      {
        heading: 'Getting Started',
        paragraphs: [
          'Create an account using OTP or password, then complete your profile for better trust and faster responses.',
          'You can browse listings without login, but login is required to message owners, post listings, and manage bookings.',
        ],
      },
      {
        heading: 'Managing Listings and Messages',
        paragraphs: [
          'Sellers can post items from My Posts and update title, photos, pricing, and availability at any time.',
          'Messages are available in the Messages section. Keep communication inside chat for transparency and safer dispute handling.',
        ],
        bullets: [
          'Use clear photos and exact pickup location details.',
          'Reply quickly to improve listing performance.',
          'Mark unavailable items as inactive to avoid confusion.',
        ],
      },
      {
        heading: 'Support Channels',
        paragraphs: [
          'For account, listing, or technical support, contact support@renthour.in with your registered email and issue details.',
        ],
      },
    ],
  },
  'safety-information': {
    slug: 'safety-information',
    title: 'Safety Information',
    description:
      'Best practices to stay safe while renting, buying, selling, and meeting other users through RentHour.',
    eyebrow: 'Support',
    sections: [
      {
        heading: 'Before You Commit',
        paragraphs: [
          'Verify profile details, listing condition, and ownership proofs before payment or handover.',
          'Ask questions in chat and keep important confirmations in writing.',
        ],
        bullets: [
          'Avoid rushing into urgent payment requests.',
          'Cross-check item serial numbers or documents when applicable.',
          'Confirm return terms before rental handover.',
        ],
      },
      {
        heading: 'Meeting and Handover Safety',
        paragraphs: [
          'Prefer public, well-lit places for first-time exchanges. Carry valid identification when needed.',
        ],
        bullets: [
          'Do not share OTPs, passwords, or payment PINs with anyone.',
          'Avoid cashless transfer requests to unknown accounts without verification.',
          'Inspect item condition at pickup and return.',
        ],
      },
      {
        heading: 'If Something Feels Wrong',
        paragraphs: [
          'Use Report a Concern immediately for suspicious behavior, fake listings, harassment, or fraud attempts.',
          'In urgent criminal risk situations, contact local law enforcement first.',
        ],
      },
    ],
  },
  'cancellation-options': {
    slug: 'cancellation-options',
    title: 'Cancellation Options',
    description:
      'Understand how cancellations work for renters and sellers and how to resolve schedule conflicts fairly.',
    eyebrow: 'Support',
    sections: [
      {
        heading: 'Renter Cancellations',
        paragraphs: [
          'If your schedule changes, inform the owner in chat as early as possible.',
          'Clearly share updated preferred date and time to reduce no-shows and disputes.',
        ],
      },
      {
        heading: 'Seller Cancellations',
        paragraphs: [
          'Sellers should avoid last-minute cancellations except for genuine emergencies.',
          'If an item becomes unavailable, notify the renter immediately and suggest alternate availability.',
        ],
      },
      {
        heading: 'Dispute Handling',
        paragraphs: [
          'If both parties cannot agree, submit a report with screenshots and conversation context.',
        ],
        bullets: [
          'Keep cancellation confirmations in chat.',
          'Avoid deleting message history until resolution is complete.',
          'Use precise time and date format to avoid misunderstandings.',
        ],
      },
    ],
  },
  'report-a-concern': {
    slug: 'report-a-concern',
    title: 'Report a Concern',
    description:
      'Report suspicious listings, fake accounts, harassment, and policy violations directly to the RentHour team.',
    eyebrow: 'Support',
    sections: [
      {
        heading: 'What You Can Report',
        paragraphs: [
          'Report fake or scam listings, abusive behavior, suspicious payment requests, spam, or policy violations.',
        ],
      },
      {
        heading: 'How to Report',
        paragraphs: [
          'Use the in-app report flow from listing or profile screens whenever possible.',
          'Include a short summary, timeline, and screenshots so moderation can act faster.',
        ],
        bullets: [
          'Report listing issue: from Product page report action.',
          'Report user issue: from Public Profile or Product owner card.',
          'Report serious legal issues: email support@renthour.in.',
        ],
      },
      {
        heading: 'Review Process',
        paragraphs: [
          'Our team reviews reports based on severity and available evidence. Accounts or listings may be restricted during review.',
        ],
      },
    ],
  },
  'list-your-item': {
    slug: 'list-your-item',
    title: 'List Your Item',
    description:
      'Learn how to create high-quality listings that get trusted responses and faster bookings.',
    eyebrow: 'Listing',
    sections: [
      {
        heading: 'Create a Strong Listing',
        paragraphs: [
          'Use a clear title, realistic pricing, and sharp photos from multiple angles.',
          'Provide accurate condition details and exact locality to set the right expectations.',
        ],
        bullets: [
          'Mention what is included with the item.',
          'Set practical availability and pickup windows.',
          'Avoid misleading titles or duplicate postings.',
        ],
      },
      {
        heading: 'After Publishing',
        paragraphs: [
          'Respond to chat inquiries quickly and keep listing details updated.',
          'If the item is not available, update or pause the listing to avoid negative reports.',
        ],
      },
    ],
  },
  'how-renting-works': {
    slug: 'how-renting-works',
    title: 'How Renting Works',
    description:
      'Step-by-step guide for finding an item, scheduling with the owner, and completing rentals safely.',
    eyebrow: 'Listing',
    sections: [
      {
        heading: 'Browse and Connect',
        paragraphs: [
          'Search by category, location, and budget, then open a listing and start chat with the owner.',
        ],
      },
      {
        heading: 'Schedule in Chat',
        paragraphs: [
          'Use the reserve flow to prepare a date and time request, then edit the draft message before sending.',
          'Finalize pickup/return terms in chat for clear records.',
        ],
      },
      {
        heading: 'Complete the Rental',
        paragraphs: [
          'Inspect item condition at pickup, confirm return timeline, and keep transaction proofs.',
        ],
      },
    ],
  },
  'seller-guidelines': {
    slug: 'seller-guidelines',
    title: 'Seller Guidelines',
    description:
      'Rules and best practices for trusted selling and renting on the RentHour marketplace.',
    eyebrow: 'Listing',
    sections: [
      {
        heading: 'Transparency and Accuracy',
        paragraphs: [
          'Only post items you own or are authorized to list. Use real photos and complete descriptions.',
        ],
        bullets: [
          'Disclose damages, missing parts, and usage limits.',
          'Mention identification or deposit requirements clearly.',
          'Avoid prohibited or restricted items.',
        ],
      },
      {
        heading: 'Communication Standards',
        paragraphs: [
          'Be respectful in chat, respond within reasonable time, and avoid asking for unsafe payments.',
        ],
      },
      {
        heading: 'Compliance and Trust',
        paragraphs: [
          'Repeated policy violations can reduce visibility or lead to temporary/permanent listing restrictions.',
        ],
      },
    ],
  },
  'pricing-tips': {
    slug: 'pricing-tips',
    title: 'Pricing Tips',
    description:
      'Set competitive prices for rentals and sales based on demand, condition, and local market behavior.',
    eyebrow: 'Listing',
    sections: [
      {
        heading: 'Set a Competitive Base Price',
        paragraphs: [
          'Compare similar listings by condition, category, and locality before publishing your price.',
        ],
      },
      {
        heading: 'Use Clear Rental Periods',
        paragraphs: [
          'Define hourly, daily, weekly, or monthly options where applicable so users can compare quickly.',
        ],
        bullets: [
          'Keep pricing simple for first-time renters.',
          'Reflect wear-and-tear risk in long-duration rates.',
          'Update price based on seasonality and demand.',
        ],
      },
      {
        heading: 'Build Trust With Value',
        paragraphs: [
          'Better photos, accurate condition notes, and faster responses often perform better than aggressive discounting alone.',
        ],
      },
    ],
  },
  'about-us': {
    slug: 'about-us',
    title: 'About Us',
    description:
      'RentHour helps people rent, buy, and sell useful items locally with safer communication and clear listings.',
    eyebrow: 'Company',
    sections: [
      {
        heading: 'Our Mission',
        paragraphs: [
          'We are building a trusted local marketplace where people can unlock value from everyday items.',
          'Our focus is practical access: rent when you need, list when you can, and connect locally.',
        ],
      },
      {
        heading: 'What We Care About',
        paragraphs: [
          'Trust, clarity, and user safety are core to our product decisions.',
        ],
        bullets: [
          'Clear listing quality standards',
          'Transparent communication tools',
          'Reliable support and reporting workflows',
        ],
      },
    ],
  },
  careers: {
    slug: 'careers',
    title: 'Careers',
    description:
      'Join RentHour and help build the future of local renting, selling, and trusted community commerce.',
    eyebrow: 'Company',
    sections: [
      {
        heading: 'Why Work With Us',
        paragraphs: [
          'We are a product-first team solving real-world marketplace problems with speed and ownership.',
          'You will work on meaningful features across trust, discovery, messaging, and growth.',
        ],
      },
      {
        heading: 'Open Roles',
        paragraphs: [
          'We regularly hire for engineering, growth, design, and operations. Share your profile even if a role is not listed yet.',
          'Email careers@renthour.in with your resume, portfolio, and role interest.',
        ],
      },
    ],
  },
  blog: {
    slug: 'blog',
    title: 'Blog',
    description:
      'Read updates, product announcements, safety tips, and marketplace best practices from RentHour.',
    eyebrow: 'Company',
    sections: [
      {
        heading: 'What We Publish',
        paragraphs: [
          'Our blog covers platform updates, trust and safety guidance, seller playbooks, and local renting insights.',
        ],
        bullets: [
          'Marketplace trends and seasonal demand tips',
          'Feature launches and product improvements',
          'Guides for renters and sellers',
        ],
      },
      {
        heading: 'Stay Updated',
        paragraphs: [
          'Follow our social channels or check back regularly for new articles and product release notes.',
        ],
      },
    ],
  },
  contact: {
    slug: 'contact',
    title: 'Contact',
    description:
      'Reach RentHour for support, partnerships, legal notices, or business inquiries.',
    eyebrow: 'Company',
    sections: [
      {
        heading: 'Support and General Queries',
        paragraphs: [
          'For account, listing, or platform issues: support@renthour.in',
          'For legal and policy notices: legal@renthour.in',
        ],
      },
      {
        heading: 'Partnerships and Business',
        paragraphs: [
          'For partnerships or promotions: partnerships@renthour.in',
          'For press or media requests: media@renthour.in',
        ],
      },
      {
        heading: 'Response Time',
        paragraphs: [
          'We usually respond within 1 to 2 business days. Please include your registered email and relevant screenshots.',
        ],
      },
    ],
  },
};

export function getFooterPage(slug: FooterPageSlug) {
  return footerPages[slug];
}

export function getAllFooterPages() {
  return footerPageOrder.map((slug) => footerPages[slug]);
}

export function getFooterPagePath(slug: FooterPageSlug) {
  return `/${slug}`;
}

export function getFooterPageMetadata(slug: FooterPageSlug): Metadata {
  const page = getFooterPage(slug);

  return {
    title: page.title,
    description: page.description,
    alternates: {
      canonical: getFooterPagePath(slug),
    },
    openGraph: {
      title: `${page.title} | ${SITE_NAME}`,
      description: page.description,
      type: 'article',
      url: getFooterPagePath(slug),
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}
