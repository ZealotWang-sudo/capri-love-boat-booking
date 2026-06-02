import Link from "next/link";

const DEVELOPMENT_TABS = [
  { href: "/admin/development?tab=tools", id: "tools", label: "Tools" },
  {
    href: "/admin/development?tab=email-preview",
    id: "email-preview",
    label: "Email Preview",
  },
  {
    href: "/admin/development?tab=message-preview",
    id: "message-preview",
    label: "Message Preview",
  },
  {
    href: "/admin/development?tab=telegram",
    id: "telegram",
    label: "Telegram settings",
  },
  {
    href: "/admin/development?tab=design",
    id: "design",
    label: "Design parameters",
  },
];

export function isDevelopmentTab(value) {
  return DEVELOPMENT_TABS.some((tab) => tab.id === value);
}

export default function DevelopmentTabs({ activeTab }) {
  return (
    <nav className="mt-8 flex flex-wrap gap-2 border-b border-stone-300 pb-4">
      {DEVELOPMENT_TABS.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={[
              "border px-4 py-3 text-xs font-medium uppercase tracking-[0.16em] transition",
              isActive
                ? "border-stone-950 bg-stone-950 text-[#f3eee7]"
                : "border-stone-300 text-stone-700 hover:border-stone-950 hover:bg-stone-950 hover:text-[#f3eee7]",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
