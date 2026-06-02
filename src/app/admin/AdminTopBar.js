"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AdminClock from "./AdminClock";
import AdminProfileMenu from "./AdminProfileMenu";
import AdminWeather from "./AdminWeather";

const ADMIN_NAV_LINKS = [
  { href: "/admin", label: "Bookings", id: "bookings" },
  { href: "/admin/calendar", label: "Calendar", id: "calendar" },
  { href: "/admin/pricing", label: "Pricing", id: "pricing" },
  { href: "/admin/promo-codes", label: "Promo Codes", id: "promo-codes" },
  { href: "/admin/development", label: "Development", id: "development" },
  { href: "/admin/data", label: "Data", id: "data" },
];

function getActiveNavId(pathname) {
  if (pathname === "/admin") {
    return "bookings";
  }

  if (
    pathname?.startsWith("/admin/email-preview") ||
    pathname?.startsWith("/admin/message")
  ) {
    return "development";
  }

  const navLink = ADMIN_NAV_LINKS
    .filter((link) => link.href !== "/admin")
    .find((link) => pathname?.startsWith(link.href));

  return navLink?.id ?? "";
}

export default function AdminTopBar({ userEmail }) {
  const pathname = usePathname();

  if (pathname?.startsWith("/admin/login")) {
    return null;
  }

  const active = getActiveNavId(pathname);

  return (
    <header className="sticky top-0 z-40 border-b border-stone-300 bg-[#f3eee7]/95 px-3 py-3 text-stone-950 backdrop-blur sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <Link
            href="/admin"
            className="brand-logo max-w-[5.5rem] text-[0.58rem] leading-4 text-stone-500 sm:max-w-none sm:text-xs"
          >
            Capri Love Boat Admin
          </Link>
          <div className="flex min-w-0 shrink-0 items-center gap-1 lg:hidden">
            <AdminClock compact />
            <AdminWeather compact />
            <AdminProfileMenu userEmail={userEmail} />
          </div>
        </div>

        <nav className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0">
          {ADMIN_NAV_LINKS.map((navLink) => {
            const isActive = navLink.id === active;

            return (
              <Link
                key={navLink.href}
                href={navLink.href}
                className={`shrink-0 border px-3 py-2 text-[0.65rem] font-medium uppercase tracking-[0.16em] transition ${
                  isActive
                    ? "border-stone-950 bg-stone-950 text-[#f3eee7]"
                    : "border-stone-300 text-stone-700 hover:border-stone-950 hover:bg-stone-950 hover:text-[#f3eee7]"
                }`}
              >
                {navLink.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden shrink-0 items-center gap-3 lg:flex">
          <AdminClock />
          <AdminWeather />
          <AdminProfileMenu userEmail={userEmail} />
        </div>
      </div>
    </header>
  );
}
