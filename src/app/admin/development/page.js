import Link from "next/link";
import {
  CreditCard,
  Database,
  Eye,
  Rocket,
  Send,
} from "lucide-react";
import AdminHeader from "../AdminHeader";
import { getAdminUser, isAllowedAdmin } from "../auth";
import UnauthorizedAdmin from "../UnauthorizedAdmin";

const DEVELOPMENT_LINKS = [
  {
    href: "/admin/email-preview",
    icon: Eye,
    isInternal: true,
    label: "Email Preview",
  },
  {
    href: "https://dashboard.stripe.com/acct_1TUI4bGni59g0iEs/dashboard",
    icon: CreditCard,
    label: "Stripe",
  },
  {
    href: "https://vercel.com/zealotwang-sudos-projects/capri-love-boat-booking-fszh",
    icon: Rocket,
    label: "Vercel",
  },
  {
    href: "https://resend.com/emails",
    icon: Send,
    label: "Resend",
  },
  {
    href: "https://supabase.com/dashboard/project/ubmpyxqsnqmvzrrvlogq",
    icon: Database,
    label: "Supabase",
  },
];

function DevelopmentLinkContent({ icon: Icon, label }) {
  return (
    <>
      <Icon className="h-4 w-4" aria-hidden="true" strokeWidth={1.75} />
      <span>{label}</span>
    </>
  );
}

const developmentLinkClassName =
  "inline-flex items-center gap-3 border border-stone-300 px-5 py-4 text-xs font-medium uppercase tracking-[0.18em] text-stone-700 transition hover:border-stone-950 hover:bg-stone-950 hover:text-[#f3eee7]";

export default async function AdminDevelopmentPage() {
  const user = await getAdminUser("/admin/development");

  if (!isAllowedAdmin(user)) {
    return <UnauthorizedAdmin />;
  }

  return (
    <main className="min-h-screen bg-[#f3eee7] px-5 py-10 text-stone-950 sm:px-8">
      <section className="mx-auto max-w-7xl">
        <AdminHeader
          active="development"
          title="Development"
          userEmail={user.email}
        />

        <section className="mt-8 border border-stone-300 bg-[#fbf8f3] p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
            Developer tools
          </p>
          <h2 className="mt-4 text-3xl font-light tracking-[-0.03em]">
            Service dashboards
          </h2>
          <div className="mt-8 flex flex-wrap gap-3">
            {DEVELOPMENT_LINKS.map((toolLink) =>
              toolLink.isInternal ? (
                <Link
                  key={toolLink.href}
                  href={toolLink.href}
                  className={developmentLinkClassName}
                >
                  <DevelopmentLinkContent
                    icon={toolLink.icon}
                    label={toolLink.label}
                  />
                </Link>
              ) : (
                <a
                  key={toolLink.href}
                  href={toolLink.href}
                  target="_blank"
                  rel="noreferrer"
                  className={developmentLinkClassName}
                >
                  <DevelopmentLinkContent
                    icon={toolLink.icon}
                    label={toolLink.label}
                  />
                </a>
              ),
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
