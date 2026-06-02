import Link from "next/link";
import {
  CreditCard,
  Database,
  Eye,
  Rocket,
  Send,
} from "lucide-react";
import AdminHeader from "../AdminHeader";
import AdminSubmitButton from "../AdminSubmitButton";
import WebsiteQrCard from "../WebsiteQrCard";
import { getAdminUser, isAllowedAdmin } from "../auth";
import UnauthorizedAdmin from "../UnauthorizedAdmin";
import {
  sendTelegramSettingsTestMessage,
  setTelegramWebhook,
} from "./actions";

const DEVELOPMENT_LINKS = [
  {
    href: "/admin/email-preview",
    icon: Eye,
    isInternal: true,
    label: "Email Preview",
  },
  {
    href: "/admin/message",
    icon: Eye,
    isInternal: true,
    label: "Message Preview",
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

const BRAND_COLORS = [
  {
    token: "Admin page background",
    value: "#f3eee7",
    swatchClassName: "bg-[#f3eee7]",
    usage: "Admin page shell backgrounds",
  },
  {
    token: "Card background",
    value: "#fbf8f3",
    swatchClassName: "bg-[#fbf8f3]",
    usage: "Cards, sections, forms, dashboard panels",
  },
  {
    token: "Primary text",
    value: "text-stone-950",
    swatchClassName: "bg-stone-950",
    usage: "Headings and key UI labels",
  },
  {
    token: "Muted text",
    value: "text-stone-500",
    swatchClassName: "bg-stone-500",
    usage: "Hints, helper labels, metadata",
  },
  {
    token: "Primary action",
    value: "bg-stone-950 / text-[#f3eee7]",
    swatchClassName: "bg-stone-950",
    usage: "Primary buttons and active states",
  },
  {
    token: "Danger action",
    value: "text-red-900",
    swatchClassName: "bg-red-900",
    usage: "Destructive actions and warnings",
  },
  {
    token: "Global light root",
    value: "#ffffff",
    swatchClassName: "bg-white",
    usage: "Global :root background token",
  },
  {
    token: "Global dark root",
    value: "#0a0a0a",
    swatchClassName: "bg-[#0a0a0a]",
    usage: "Global dark-scheme root background token",
  },
];

const TYPOGRAPHY_TOKENS = [
  {
    token: "Brand logo (.brand-logo)",
    value:
      '"Times New Roman", Georgia, serif · 400 · letter-spacing 0.28em · uppercase',
    usage: "Capri Love Boat wordmark text",
  },
  {
    token: "Display serif (.font-display)",
    value: '"Times New Roman", Georgia, serif · 400',
    usage: "Editorial or hero-like display moments",
  },
  {
    token: "Body text",
    value: "Arial, Helvetica, sans-serif",
    usage: "Default body and general app text",
  },
  {
    token: "Admin title style",
    value: "font-light · tracking-[-0.03em] · text-3xl/4xl",
    usage: "Admin page and section titles",
  },
  {
    token: "UI labels / buttons",
    value: "uppercase · tracking-[0.16em ~ 0.22em] · text-xs",
    usage: "Navigation chips, buttons, micro labels",
  },
];

const LAYOUT_TOKENS = [
  {
    token: "Page shell",
    value: "min-h-screen bg-[#f3eee7] px-5 py-10 sm:px-8",
    usage: "Default admin page outer layout",
  },
  {
    token: "Content width",
    value: "mx-auto max-w-7xl",
    usage: "Main content container width",
  },
  {
    token: "Section rhythm",
    value: "mt-8 / mt-6 / mt-4",
    usage: "Vertical spacing between blocks",
  },
  {
    token: "Panel spacing",
    value: "p-6 sm:p-8 or p-5 sm:p-6",
    usage: "Primary section and card padding",
  },
  {
    token: "Button spacing",
    value: "px-5 py-3 (primary) / px-3 py-2 (compact)",
    usage: "Primary and secondary action buttons",
  },
  {
    token: "Border language",
    value: "border border-stone-300 / border-stone-950",
    usage: "Neutral cards and emphasized controls",
  },
];

function BrandColorCard({ color }) {
  return (
    <article className="border border-stone-300 bg-[#fbf8f3] p-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`h-8 w-8 border border-stone-300 ${color.swatchClassName}`}
        />
        <div>
          <p className="text-sm font-medium text-stone-950">{color.token}</p>
          <p className="text-xs text-stone-600">{color.value}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-stone-500">{color.usage}</p>
    </article>
  );
}

function TokenTable({ rows, title }) {
  return (
    <section className="border border-stone-300 bg-[#fbf8f3] p-5 sm:p-6">
      <h3 className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
        {title}
      </h3>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[540px] divide-y divide-stone-200 text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.16em] text-stone-500">
            <tr>
              <th className="py-2 pr-3">Token</th>
              <th className="py-2 pr-3">Value</th>
              <th className="py-2">Usage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {rows.map((row) => (
              <tr key={row.token}>
                <td className="py-3 pr-3 font-medium text-stone-950">{row.token}</td>
                <td className="py-3 pr-3 text-stone-700">
                  <code>{row.value}</code>
                </td>
                <td className="py-3 text-stone-600">{row.usage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function getTelegramTestNotice(searchParams) {
  const value = searchParams?.telegramTest;

  if (value === "sent") {
    return {
      tone: "success",
      text: "Telegram test message sent.",
    };
  }

  if (value === "failed") {
    return {
      tone: "error",
      text: "Telegram test message failed. Check server logs for details.",
    };
  }

  return null;
}

function getTelegramWebhookNotice(searchParams) {
  const value = searchParams?.telegramWebhook;

  if (value === "production-set") {
    return {
      tone: "success",
      text: "Telegram production webhook set.",
    };
  }

  if (value === "preview-set") {
    return {
      tone: "success",
      text: "Telegram preview webhook set.",
    };
  }

  if (value === "production-missing") {
    return {
      tone: "error",
      text: "Production webhook target or Telegram bot token is missing.",
    };
  }

  if (value === "preview-missing") {
    return {
      tone: "error",
      text: "Preview webhook target or Telegram bot token is missing.",
    };
  }

  if (value === "production-failed" || value === "preview-failed") {
    return {
      tone: "error",
      text: "Could not set Telegram webhook. Check server logs for details.",
    };
  }

  return null;
}

function NoticeBox({ notice }) {
  if (!notice) {
    return null;
  }

  return (
    <div
      className={[
        "mt-5 border p-4 text-sm leading-6",
        notice.tone === "error"
          ? "border-red-900/40 bg-red-50 text-red-900"
          : "border-emerald-900/30 bg-emerald-50 text-emerald-900",
      ].join(" ")}
    >
      {notice.text}
    </div>
  );
}

export default async function AdminDevelopmentPage({ searchParams }) {
  const user = await getAdminUser("/admin/development");

  if (!isAllowedAdmin(user)) {
    return <UnauthorizedAdmin />;
  }

  const queryParams = await searchParams;
  const telegramTestNotice = getTelegramTestNotice(queryParams);
  const telegramWebhookNotice = getTelegramWebhookNotice(queryParams);
  const hasProductionWebhookTarget = Boolean(
    process.env.TELEGRAM_WEBHOOK_PRODUCTION_URL || process.env.NEXT_PUBLIC_SITE_URL,
  );
  const hasPreviewWebhookTarget = Boolean(process.env.TELEGRAM_WEBHOOK_PREVIEW_URL);

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

        <section className="mt-6 border border-stone-300 bg-[#fbf8f3] p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
            Telegram settings
          </p>
          <h2 className="mt-4 text-3xl font-light tracking-[-0.03em]">
            Telegram test message
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">
            Send a test message to the captain Telegram group with one inline
            button. Clicking the button should create a webhook event in the
            server logs.
          </p>
          <NoticeBox notice={telegramTestNotice} />
          <NoticeBox notice={telegramWebhookNotice} />

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <form
              action={sendTelegramSettingsTestMessage}
              className="border border-stone-300 p-4"
            >
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
                Test message
              </p>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                Sends “hello here” with a “hello back” webhook test button.
              </p>
              <AdminSubmitButton
                pendingLabel="Sending Telegram test..."
                className="mt-4 border border-stone-950 bg-stone-950 px-5 py-3 text-xs font-medium uppercase tracking-[0.18em] text-[#f3eee7] transition hover:bg-transparent hover:text-stone-950 disabled:cursor-wait disabled:opacity-60"
              >
                Send Telegram test
              </AdminSubmitButton>
            </form>

            <form action={setTelegramWebhook} className="border border-stone-300 p-4">
              <input type="hidden" name="target" value="production" />
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
                Production webhook
              </p>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                Uses the production webhook target from environment settings.
              </p>
              <p className="mt-2 text-xs text-stone-500">
                {hasProductionWebhookTarget ? "Target configured" : "Target missing"}
              </p>
              <AdminSubmitButton
                disabled={!hasProductionWebhookTarget}
                pendingLabel="Setting production..."
                className="mt-4 border border-stone-950 bg-stone-950 px-5 py-3 text-xs font-medium uppercase tracking-[0.18em] text-[#f3eee7] transition hover:bg-transparent hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Set production webhook
              </AdminSubmitButton>
            </form>

            <form action={setTelegramWebhook} className="border border-stone-300 p-4">
              <input type="hidden" name="target" value="preview" />
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
                Preview webhook
              </p>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                Uses the preview webhook target from environment settings.
              </p>
              <p className="mt-2 text-xs text-stone-500">
                {hasPreviewWebhookTarget ? "Target configured" : "Target missing"}
              </p>
              <AdminSubmitButton
                disabled={!hasPreviewWebhookTarget}
                pendingLabel="Setting preview..."
                className="mt-4 border border-stone-950 bg-stone-950 px-5 py-3 text-xs font-medium uppercase tracking-[0.18em] text-[#f3eee7] transition hover:bg-transparent hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Set preview webhook
              </AdminSubmitButton>
            </form>
          </div>
        </section>

        <section className="mt-6 border border-stone-300 bg-[#fbf8f3] p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
            Brand house
          </p>
          <h2 className="mt-4 text-3xl font-light tracking-[-0.03em]">
            Design parameters
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">
            Live design tokens used in the current codebase for colors, type, and
            layout rhythm.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {BRAND_COLORS.map((color) => (
              <BrandColorCard key={color.token} color={color} />
            ))}
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <TokenTable rows={TYPOGRAPHY_TOKENS} title="Typography" />
            <TokenTable rows={LAYOUT_TOKENS} title="Spacing & layout" />
          </div>
        </section>

        <WebsiteQrCard />
      </section>
    </main>
  );
}
