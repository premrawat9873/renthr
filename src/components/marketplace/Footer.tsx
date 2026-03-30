import { Globe, Instagram, Twitter, Facebook, Youtube } from "lucide-react";

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-primary/35 bg-primary text-primary-foreground">
      <div className="container py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Support */}
          <div className="space-y-3">
            <h4 className="font-heading font-medium text-sm text-primary-foreground">Support</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/75">
              <li><a href="#" className="hover:text-highlight transition-colors duration-200">Help Centre</a></li>
              <li><a href="#" className="hover:text-highlight transition-colors duration-200">Safety Information</a></li>
              <li><a href="#" className="hover:text-highlight transition-colors duration-200">Cancellation Options</a></li>
              <li><a href="#" className="hover:text-highlight transition-colors duration-200">Report a Concern</a></li>
            </ul>
          </div>
          {/* Listing */}
          <div className="space-y-3">
            <h4 className="font-heading font-medium text-sm text-primary-foreground">Listing</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/75">
              <li><a href="#" className="hover:text-highlight transition-colors duration-200">List Your Item</a></li>
              <li><a href="#" className="hover:text-highlight transition-colors duration-200">How Renting Works</a></li>
              <li><a href="#" className="hover:text-highlight transition-colors duration-200">Seller Guidelines</a></li>
              <li><a href="#" className="hover:text-highlight transition-colors duration-200">Pricing Tips</a></li>
            </ul>
          </div>
          {/* Company */}
          <div className="space-y-3">
            <h4 className="font-heading font-medium text-sm text-primary-foreground">Company</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/75">
              <li><a href="#" className="hover:text-highlight transition-colors duration-200">About Us</a></li>
              <li><a href="#" className="hover:text-highlight transition-colors duration-200">Careers</a></li>
              <li><a href="#" className="hover:text-highlight transition-colors duration-200">Blog</a></li>
              <li><a href="#" className="hover:text-highlight transition-colors duration-200">Contact</a></li>
            </ul>
          </div>
          {/* Connect */}
          <div className="space-y-3">
            <h4 className="font-heading font-medium text-sm text-primary-foreground">Connect</h4>
            <div className="flex items-center gap-3">
              <a href="#" className="h-9 w-9 rounded-full border border-primary-foreground/30 bg-primary-foreground/10 flex items-center justify-center text-primary-foreground/80 hover:text-highlight hover:border-highlight/70 hover:bg-primary-foreground/15 transition-all duration-200">
                <Instagram className="h-4 w-4" />
              </a>
              <a href="#" className="h-9 w-9 rounded-full border border-primary-foreground/30 bg-primary-foreground/10 flex items-center justify-center text-primary-foreground/80 hover:text-highlight hover:border-highlight/70 hover:bg-primary-foreground/15 transition-all duration-200">
                <Twitter className="h-4 w-4" />
              </a>
              <a href="#" className="h-9 w-9 rounded-full border border-primary-foreground/30 bg-primary-foreground/10 flex items-center justify-center text-primary-foreground/80 hover:text-highlight hover:border-highlight/70 hover:bg-primary-foreground/15 transition-all duration-200">
                <Facebook className="h-4 w-4" />
              </a>
              <a href="#" className="h-9 w-9 rounded-full border border-primary-foreground/30 bg-primary-foreground/10 flex items-center justify-center text-primary-foreground/80 hover:text-highlight hover:border-highlight/70 hover:bg-primary-foreground/15 transition-all duration-200">
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
            <a href="#" className="hover:text-highlight transition-colors">Privacy</a>
            <span>·</span>
            <a href="#" className="hover:text-highlight transition-colors">Terms</a>
            <span>·</span>
            <a href="#" className="hover:text-highlight transition-colors">Sitemap</a>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-1 hover:text-highlight transition-colors">
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
