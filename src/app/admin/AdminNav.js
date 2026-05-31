import Link from "next/link";

const ADMIN_NAV_LINKS = [
  { href: "/admin", label: "Bookings", id: "bookings" },
  { href: "/admin/calendar", label: "Calendar", id: "calendar" },
  { href: "/admin/pricing", label: "Pricing", id: "pricing" },
  { href: "/admin/promo-codes", label: "Promo Codes", id: "promo-codes" },
  { href: "/admin/development", label: "Development", id: "development" },
  { href: "/admin/data", label: "Data", id: "data" },
];

export default function AdminNav({ active }) {
  return (
    <nav className="flex flex-wrap gap-2">
      {ADMIN_NAV_LINKS.map((navLink) => {
        const isActive = navLink.id === active;

        return (
          <Link
            key={navLink.href}
            href={navLink.href}
            className={`border px-3 py-2 text-[0.65rem] font-medium uppercase tracking-[0.16em] transition ${
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
  );
}
