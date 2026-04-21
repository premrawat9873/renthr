import { Globe, Instagram, Twitter, Facebook, Youtube } from "lucide-react";
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-primary/35 bg-primary text-primary-foreground">
      <div className="container py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Support */}
          <div className="space-y-3">
            <h4 className="font-heading font-medium text-sm text-primary-foreground">Support</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/75">
              <li><Link href="/help-centre" className="hover:text-highlight transition-colors duration-200">Help Centre</Link></li>
              <li><Link href="/safety-information" className="hover:text-highlight transition-colors duration-200">Safety Information</Link></li>
              <li><Link href="/cancellation-options" className="hover:text-highlight transition-colors duration-200">Cancellation Options</Link></li>
              <li><Link href="/report-a-concern" className="hover:text-highlight transition-colors duration-200">Report a Concern</Link></li>
            </ul>
          </div>
          {/* Listing */}
          <div className="space-y-3">
            <h4 className="font-heading font-medium text-sm text-primary-foreground">Listing</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/75">
              <li><Link href="/list-your-item" className="hover:text-highlight transition-colors duration-200">List Your Item</Link></li>
              <li><Link href="/how-renting-works" className="hover:text-highlight transition-colors duration-200">How Renting Works</Link></li>
              <li><Link href="/seller-guidelines" className="hover:text-highlight transition-colors duration-200">Seller Guidelines</Link></li>
              <li><Link href="/pricing-tips" className="hover:text-highlight transition-colors duration-200">Pricing Tips</Link></li>
            </ul>
          </div>
          {/* Company */}
          <div className="space-y-3">
            <h4 className="font-heading font-medium text-sm text-primary-foreground">Company</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/75">
              <li><Link href="/about-us" className="hover:text-highlight transition-colors duration-200">About Us</Link></li>
              <li><Link href="/careers" className="hover:text-highlight transition-colors duration-200">Careers</Link></li>
              <li><Link href="/blog" className="hover:text-highlight transition-colors duration-200">Blog</Link></li>
              <li><Link href="/contact" className="hover:text-highlight transition-colors duration-200">Contact</Link></li>
            </ul>
          </div>
          {/* Connect */}
          <div className="space-y-3">
            <h4 className="font-heading font-medium text-sm text-primary-foreground">Connect</h4>
            <div className="flex items-center gap-3">
              <a href="https://www.instagram.com/rent_hour_/" aria-label="Instagram" className="h-9 w-9 rounded-full border border-primary-foreground/30 bg-primary-foreground/10 flex items-center justify-center text-primary-foreground/80 hover:text-highlight hover:border-highlight/70 hover:bg-primary-foreground/15 transition-all duration-200">
                <Instagram className="h-4 w-4" />
              </a>
              <a href="https://x.com" aria-label="X (Twitter)" className="h-9 w-9 rounded-full border border-primary-foreground/30 bg-primary-foreground/10 flex items-center justify-center text-primary-foreground/80 hover:text-highlight hover:border-highlight/70 hover:bg-primary-foreground/15 transition-all duration-200">
                <Twitter className="h-4 w-4" />
              </a>
              <a href="https://facebook.com" aria-label="Facebook" className="h-9 w-9 rounded-full border border-primary-foreground/30 bg-primary-foreground/10 flex items-center justify-center text-primary-foreground/80 hover:text-highlight hover:border-highlight/70 hover:bg-primary-foreground/15 transition-all duration-200">
                <Facebook className="h-4 w-4" />
              </a>
              <a href="https://youtube.com" aria-label="YouTube" className="h-9 w-9 rounded-full border border-primary-foreground/30 bg-primary-foreground/10 flex items-center justify-center text-primary-foreground/80 hover:text-highlight hover:border-highlight/70 hover:bg-primary-foreground/15 transition-all duration-200">
                <Youtube className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-primary-foreground/20 bg-primary/90">
        <div className="container py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-primary-foreground/75">
          <div className="flex items-center gap-1">
            <span>© 2026</span>
            <span className="font-heading font-semibold text-primary-foreground">rent</span>
            <span className="font-heading font-semibold text-highlight-foreground bg-highlight px-1 py-0.5 rounded text-[10px]">hour</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/privacy-policy" className="hover:text-highlight transition-colors">
              Privacy
            </Link>
            <span>·</span>
            <Link href="/terms-of-use" className="hover:text-highlight transition-colors">
              Terms
            </Link>
            <span>·</span>
            <Link href="/sitemap" className="hover:text-highlight transition-colors">Sitemap</Link>
          </div>
          <div className="flex items-center gap-3">
            <button aria-label="Current language English" className="flex items-center gap-1 hover:text-highlight transition-colors">
              <Globe className="h-3.5 w-3.5" />
              English
            </button>
            <span className="text-primary-foreground/70">₹ INR</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
