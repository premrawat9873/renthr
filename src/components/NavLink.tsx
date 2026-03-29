import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavLinkProps = React.ComponentPropsWithoutRef<typeof Link> & {
  activeClassName?: string;
};

function NavLink({ className, activeClassName, href, ...props }: NavLinkProps) {
  const pathname = usePathname();
  const hrefPath = typeof href === "string" ? href : href.toString();
  const isActive =
    pathname === hrefPath ||
    (hrefPath !== "/" && pathname.startsWith(`${hrefPath}/`));

  return (
    <Link
      href={href}
      className={cn(className, isActive && activeClassName)}
      {...props}
    />
  );
}

export { NavLink };
