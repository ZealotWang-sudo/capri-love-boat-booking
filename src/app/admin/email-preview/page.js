import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BOOKING_EMAIL_EVENTS,
  SUPPORTED_EMAIL_LOCALES,
  buildBookingEmailPreview,
} from "@/lib/email/sendBookingEmail";
import {
  SHARED_JOIN_EMAIL_EVENTS,
  buildSharedJoinEmailPreview,
} from "@/lib/email/sendSharedJoinEmail";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ADMIN_EMAIL = "wangkexin-personal@outlook.com";
const LANGUAGE_LABELS = {
  de: "German",
  en: "English",
  fr: "French",
  it: "Italian",
  zh: "Chinese",
};
const PREVIEW_BOOKING = {
  cancellation_reason:
    "Example reason: sea conditions changed and the captain cannot operate safely.",
  customer_cancel_reason: "",
  customer_name: "Kexin Wang",
  email: "guest@example.com",
  guest_count: 2,
  locale: "en",
  manage_url: "https://capriloveboat.com/en/booking/manage/example?token=preview",
  pay_on_board_eur: 280,
  requested_date: "2026-05-19",
  reservation_fee_eur: 70,
  time_slot: "morning_0930",
  time_window: "09:30",
  total_price_eur: 350,
  tour_type: "three_hours",
};
const PREVIEW_SHARED_REQUEST = {
  customer_manage_token: "shared-preview-token",
  customer_name: "Wei Wei",
  gender_composition: "all_female",
  guest_count: 4,
  id: "shared-preview-request",
  locale: "en",
  shared_request_fee_eur: 70,
};

function getPreviewBooking(locale, eventType) {
  const needsReason =
    eventType === "cancelled" ||
    eventType === "not_available" ||
    eventType === "shared_primary_cancelled_promoted";

  return {
    ...PREVIEW_BOOKING,
    cancellation_reason: needsReason ? PREVIEW_BOOKING.cancellation_reason : "",
    locale,
    manage_url: `https://capriloveboat.com/${locale}/booking/manage/example?token=preview`,
  };
}

function PreviewCard({ event, locale }) {
  const preview = buildBookingEmailPreview({
    booking: getPreviewBooking(locale, event.eventType),
    eventType: event.eventType,
    locale,
  });

  if (!preview) {
    return null;
  }

  return (
    <article className="border border-stone-300 bg-[#fbf8f3]">
      <div className="border-b border-stone-300 px-4 py-4">
        <p className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-stone-500">
          {event.label} · {LANGUAGE_LABELS[locale] ?? locale}
        </p>
        <h2 className="mt-2 text-lg font-medium text-stone-950">
          {preview.subject}
        </h2>
        <p className="mt-1 text-xs text-stone-500">Button: {preview.cta}</p>
      </div>
      <div
        className="overflow-hidden bg-[#f0f0f0]"
        dangerouslySetInnerHTML={{ __html: preview.html }}
      />
    </article>
  );
}

function SharedPreviewCard({ event, locale }) {
  const preview = buildSharedJoinEmailPreview({
    booking: getPreviewBooking(locale, "booking_confirmed"),
    eventType: event.eventType,
    locale,
    manageUrl: `https://capriloveboat.com/${locale}/shared/manage/shared-preview-request?token=shared-preview-token`,
    request: {
      ...PREVIEW_SHARED_REQUEST,
      locale,
    },
  });

  if (!preview) {
    return null;
  }

  return (
    <article className="border border-stone-300 bg-[#fbf8f3]">
      <div className="border-b border-stone-300 px-4 py-4">
        <p className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-stone-500">
          {event.label} · {LANGUAGE_LABELS[locale] ?? locale}
        </p>
        <h2 className="mt-2 text-lg font-medium text-stone-950">
          {preview.subject}
        </h2>
        <p className="mt-1 text-xs text-stone-500">Button: {preview.cta}</p>
      </div>
      <div
        className="overflow-hidden bg-[#f0f0f0]"
        dangerouslySetInnerHTML={{ __html: preview.html }}
      />
    </article>
  );
}

export default async function AdminEmailPreviewPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login?next=/admin/email-preview");
  }

  if (user.email?.toLowerCase() !== ADMIN_EMAIL) {
    return (
      <main className="min-h-screen bg-[#f3eee7] px-5 py-16 text-stone-950 sm:px-8">
        <section className="mx-auto max-w-3xl border-t border-stone-300 pt-10">
          <p className="brand-logo text-xs text-stone-500">
            Capri Love Boat Admin
          </p>
          <h1 className="mt-8 text-4xl font-light tracking-[-0.03em]">
            Unauthorized
          </h1>
          <p className="mt-6 text-stone-600">
            This account does not have access to the admin area.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f3eee7] px-5 py-10 text-stone-950 sm:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-6 border-b border-stone-300 pb-8 sm:flex-row sm:items-end">
          <div>
            <p className="brand-logo text-xs text-stone-500">
              Capri Love Boat Admin
            </p>
            <h1 className="mt-5 text-4xl font-light tracking-[-0.03em]">
              Email preview
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
              These previews are generated from the same helper used for live
              transactional emails. Edit the copy in the message JSON files and
              this page updates automatically.
            </p>
          </div>
          <Link
            href="/admin"
            className="border border-stone-950 px-6 py-4 text-xs font-medium uppercase tracking-[0.22em] transition hover:bg-stone-950 hover:text-[#f3eee7]"
          >
            Back to admin
          </Link>
        </div>

        <div className="mt-8 space-y-10">
          {SUPPORTED_EMAIL_LOCALES.map((locale) => (
            <section key={locale}>
              <div className="mb-4 border-b border-stone-300 pb-3">
                <h2 className="text-sm font-medium uppercase tracking-[0.18em]">
                  {LANGUAGE_LABELS[locale] ?? locale}
                </h2>
              </div>
              <h3 className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
                Booking emails
              </h3>
              <div className="grid gap-6 xl:grid-cols-2">
                {BOOKING_EMAIL_EVENTS.map((event) => (
                  <PreviewCard
                    key={`${locale}-${event.eventType}`}
                    event={event}
                    locale={locale}
                  />
                ))}
              </div>
              <h3 className="mt-8 mb-4 text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
                Shared join emails
              </h3>
              <div className="grid gap-6 xl:grid-cols-2">
                {SHARED_JOIN_EMAIL_EVENTS.map((event) => (
                  <SharedPreviewCard
                    key={`${locale}-${event.eventType}`}
                    event={event}
                    locale={locale}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
