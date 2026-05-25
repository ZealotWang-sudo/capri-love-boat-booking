import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { POLICY_ITEM_KEYS } from "@/components/PolicyContent";
import SharedJoinRequestForm from "@/components/SharedJoinRequestForm";
import SiteHeader from "@/components/SiteHeader";
import { formatCustomerDate } from "@/lib/formatCustomerDate";
import {
  ACTIVE_SHARED_JOIN_REQUEST_STATUSES,
  getSharedBookingDisplayTime,
  getSharedJoinCapacity,
  isWithinJoinRequestCutoff,
  MAX_BOAT_CAPACITY,
} from "@/lib/sharedBoat";
import { createSupabaseServiceRoleServerClient } from "@/lib/supabase/server";
import { handleSharedJoinCheckoutSessionCompleted } from "@/lib/stripe/sharedJoinRequests";
import { getActiveTourPriceByType } from "@/lib/tourPrices";

const SHARED_BOOKING_SELECT =
  "id, requested_date, time_slot, time_window, tour_type, guest_count, pay_on_board_eur, booking_status, payment_status, is_shared_open, shared_status, shared_open_seats, shared_gender_preference, shared_public_token";
const CLOSED_SHARED_STATUSES = new Set(["connected", "closed"]);
const GENDER_PREFERENCE_LABEL_KEYS = {
  any: "genderPreference.any",
  female_only: "genderPreference.female_only",
  male_only: "genderPreference.male_only",
};
const TOUR_LABEL_KEYS = {
  five_hours: "tourLabels.five_hours",
  four_hours: "tourLabels.four_hours",
  special_request: "tourLabels.special_request",
  sunset_three_hours: "tourLabels.sunset_three_hours",
  three_hours: "tourLabels.three_hours",
  two_hours: "tourLabels.two_hours",
};

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Shared" });

  return {
    title: `${t("title")} | Capri Love Boat`,
    robots: {
      follow: false,
      index: false,
    },
  };
}

function getText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidSharedBooking(booking, token) {
  return Boolean(
    booking &&
      booking.shared_public_token === token &&
      booking.is_shared_open === true &&
      booking.booking_status === "confirmed" &&
      booking.payment_status === "captured",
  );
}

async function getSharedBooking(token) {
  if (!token || token.length < 16) {
    return null;
  }

  const supabase = createSupabaseServiceRoleServerClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(SHARED_BOOKING_SELECT)
    .eq("shared_public_token", token)
    .maybeSingle();

  if (error) {
    console.error("[shared booking page] Could not load booking", error.message);
    return null;
  }

  return data;
}

async function getSharedRequestFeeEur(booking) {
  const supabase = createSupabaseServiceRoleServerClient();
  const { data: tourPrice, error } = await getActiveTourPriceByType(
    supabase,
    booking.tour_type,
  );

  if (error) {
    console.error("[shared booking page] Could not load tour price", error.message);
    return null;
  }

  return tourPrice?.reservation_fee_eur ?? null;
}

async function hasActiveJoinRequest(bookingId) {
  const supabase = createSupabaseServiceRoleServerClient();
  const { data, error } = await supabase
    .from("shared_join_requests")
    .select("id")
    .eq("booking_id", bookingId)
    .in("status", ACTIVE_SHARED_JOIN_REQUEST_STATUSES)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[shared booking page] Could not check join requests", error.message);
    return true;
  }

  return Boolean(data);
}

function DetailItem({ label, value }) {
  return (
    <div className="border-b border-stone-200 py-3">
      <p className="text-[0.65rem] uppercase tracking-[0.16em] text-stone-500">
        {label}
      </p>
      <p className="mt-1 text-sm text-stone-950">{value || "-"}</p>
    </div>
  );
}

function formatEuro(value) {
  return typeof value === "number" ? `€${value}` : "-";
}

function formatSharedPayOnBoardSplit(value) {
  if (typeof value !== "number") {
    return "-";
  }

  const splitAmount = value / 2;
  const formattedSplitAmount = Number.isInteger(splitAmount)
    ? splitAmount
    : splitAmount.toFixed(2);

  return `${formatEuro(value)} / 2 = €${formattedSplitAmount}`;
}

function getStatusMessageKey(booking, isCutoffClosed, activeRequestExists) {
  if (isCutoffClosed) {
    return "statusCutoff";
  }

  if (booking.shared_status === "open") {
    return "statusOpen";
  }

  if (CLOSED_SHARED_STATUSES.has(booking.shared_status)) {
    return "statusClosed";
  }

  if (activeRequestExists || booking.shared_status === "active_request") {
    return "statusActiveRequest";
  }

  if (booking.shared_status === "pending_captain_confirmation") {
    return "statusPending";
  }

  if (booking.shared_status === "cancelled") {
    return "statusCancelled";
  }

  return "notAvailableMessage";
}

function getJoinResultMessageKey({ checkoutResult, joinStatus }) {
  if (joinStatus === "cancelled") {
    return "joinCancelledMessage";
  }

  if (joinStatus !== "success") {
    return null;
  }

  if (checkoutResult?.released) {
    return "joinAlreadyTakenMessage";
  }

  return "joinSuccessMessage";
}

function getGenderOptions({ booking, t }) {
  const allOptions = [
    { label: t("genderCompositionAllFemale"), value: "all_female" },
    { label: t("genderCompositionAllMale"), value: "all_male" },
    { label: t("genderCompositionMixed"), value: "mixed" },
    {
      label: t("genderCompositionPreferNotToSay"),
      value: "prefer_not_to_say",
    },
  ];

  if (booking.shared_gender_preference === "female_only") {
    return allOptions.filter((option) => option.value === "all_female");
  }

  if (booking.shared_gender_preference === "male_only") {
    return allOptions.filter((option) => option.value === "all_male");
  }

  return allOptions;
}

function getJoinFormLabels({ booking, policyT, t }) {
  return {
    consent: t("joinConsent"),
    contactOptions: [
      { label: t("contactWhatsapp"), value: "whatsapp" },
      { label: t("contactWechat"), value: "wechat" },
      { label: t("contactEmail"), value: "email" },
      { label: t("contactPhone"), value: "phone" },
    ],
    contactWechat: t("contactWechat"),
    confirmEmail: t("joinConfirmEmail"),
    customerName: t("joinCustomerName"),
    email: t("joinEmail"),
    emailMismatch: t("joinEmailMismatch"),
    errors: {
      activeRequestExists: t("joinErrorActiveRequestExists"),
      bookingUnavailable: t("joinErrorBookingUnavailable"),
      consentRequired: t("joinErrorConsentRequired"),
      cutoffClosed: t("joinErrorCutoffClosed"),
      emailMismatch: t("joinEmailMismatch"),
      genderPreferenceMismatch: t("joinErrorGenderPreferenceMismatch"),
      generic: t("joinErrorGeneric"),
      invalidContactMethod: t("joinErrorInvalidContactMethod"),
      invalidEmail: t("joinErrorInvalidEmail"),
      invalidGenderComposition: t("joinErrorInvalidGenderComposition"),
      invalidGuestCount: t("joinErrorInvalidGuestCount"),
      invalidPromoCode: t("joinErrorInvalidPromoCode"),
      invalidRequest: t("joinErrorInvalidRequest"),
      missingPreferredContact: t("joinErrorMissingPreferredContact"),
      missingRequired: t("joinErrorMissingRequired"),
    },
    genderComposition: t("joinGenderComposition"),
    guestCount: t("joinGuestCount"),
    intro: t("joinFormIntro"),
    message: t("joinMessage"),
    phone: t("joinPhone"),
    phoneCountryCode: t("joinPhoneCountryCode"),
    preAuthorization: t("joinPreAuthorization"),
    preferredContactMethod: t("joinPreferredContactMethod"),
    promoApply: t("promoApply"),
    promoApplied: t("promoApplied"),
    promoApplying: t("promoApplying"),
    promoCode: t("promoCode"),
    promoCodePlaceholder: t("promoCodePlaceholder"),
    promoDiscount: t("promoDiscount"),
    promoInvalid: t("promoInvalid"),
    authorizationAmount: t("authorizationAmount"),
    costSplitNote: t("costSplitNote", {
      payOnBoard: formatEuro(booking.pay_on_board_eur),
    }),
    disclaimer: t("disclaimer"),
    disclaimerTitle: t("disclaimerTitle"),
    confirmModalAccept: t("confirmModalAccept"),
    confirmModalClose: t("confirmModalClose"),
    confirmModalIntro: t("confirmModalIntro"),
    confirmModalTitle: t("confirmModalTitle"),
    policy: {
      introTitle: policyT("introTitle"),
      introText: policyT("introText"),
      ...Object.fromEntries(
        POLICY_ITEM_KEYS.flatMap((itemKey) => [
          [`${itemKey}Title`, policyT(`${itemKey}Title`)],
          [`${itemKey}Text`, policyT(`${itemKey}Text`)],
        ]),
      ),
    },
    submitButton: t("joinSubmitButton"),
    submittingButton: t("joinSubmittingButton"),
    title: t("joinFormTitle"),
    whatsapp: t("joinWhatsapp"),
    wechat: t("joinWechat"),
  };
}

export default async function SharedBoatPage({ params, searchParams }) {
  const { locale, token } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("Shared");
  const policyT = await getTranslations("Policy");
  const common = await getTranslations("Common");
  const cleanToken = getText(token);
  const joinStatus = getText(query?.join);
  const stripeSessionId = getText(query?.session_id);
  let checkoutResult = null;

  if (joinStatus === "success" && stripeSessionId) {
    try {
      checkoutResult = await handleSharedJoinCheckoutSessionCompleted({
        sessionId: stripeSessionId,
      });
    } catch (error) {
      console.error("[shared booking page] Could not confirm join checkout", {
        message: error.message,
        sessionId: stripeSessionId,
      });
    }
  }

  const booking = await getSharedBooking(cleanToken);
  const validBooking = isValidSharedBooking(booking, cleanToken);

  if (!validBooking) {
    return (
      <main className="min-h-screen bg-[#f3eee7] text-stone-950">
        <SiteHeader brand={common("brand")} locale={locale} path="/shared" />
        <section className="mx-auto max-w-3xl px-5 py-20 text-center sm:px-8">
          <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
            {t("eyebrow")}
          </p>
          <h1 className="mt-6 text-4xl font-light tracking-[-0.03em] sm:text-6xl">
            {t("notAvailableTitle")}
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg font-light leading-8 text-stone-600">
            {t("notAvailableMessage")}
          </p>
          <Link
            href={`/${locale}`}
            className="mt-10 inline-flex border border-stone-950 bg-stone-950 px-8 py-4 text-xs font-medium uppercase tracking-[0.22em] text-[#f3eee7] transition hover:bg-transparent hover:text-stone-950"
          >
            {common("home")}
          </Link>
        </section>
      </main>
    );
  }

  const isCutoffClosed =
    booking.shared_status === "open" && isWithinJoinRequestCutoff(booking);
  const activeRequestExists = await hasActiveJoinRequest(booking.id);
  const maxJoinGuests = getSharedJoinCapacity(booking);
  const sharedRequestFeeEur = await getSharedRequestFeeEur(booking);
  const isJoinable =
    booking.shared_status === "open" &&
    !isCutoffClosed &&
    !activeRequestExists &&
    maxJoinGuests > 0 &&
    typeof sharedRequestFeeEur === "number" &&
    sharedRequestFeeEur > 0;
  const statusMessageKey = getStatusMessageKey(
    booking,
    isCutoffClosed,
    activeRequestExists,
  );
  const joinResultMessageKey = getJoinResultMessageKey({
    checkoutResult,
    joinStatus,
  });
  const tourTypeLabelKey = TOUR_LABEL_KEYS[booking.tour_type];
  const genderPreferenceLabelKey =
    GENDER_PREFERENCE_LABEL_KEYS[booking.shared_gender_preference] ??
    GENDER_PREFERENCE_LABEL_KEYS.any;
  const tourTypeLabel = tourTypeLabelKey ? t(tourTypeLabelKey) : booking.tour_type;
  const genderPreferenceLabel = t(genderPreferenceLabelKey);
  const displayTime = getSharedBookingDisplayTime(booking);
  const genderOptions = getGenderOptions({ booking, t });
  const isSharedInviteEnded =
    CLOSED_SHARED_STATUSES.has(booking.shared_status) ||
    booking.shared_status === "cancelled" ||
    isCutoffClosed;

  if (isSharedInviteEnded) {
    return (
      <main className="min-h-screen bg-[#f3eee7] text-stone-950">
        <SiteHeader brand={common("brand")} locale={locale} path="/shared" />
        <section className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-5 py-20 text-center sm:px-8">
          <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
            {t("eyebrow")}
          </p>
          <h1 className="mt-6 text-4xl font-light tracking-[-0.03em] sm:text-6xl">
            {t("sharedEndedTitle")}
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg font-light leading-8 text-stone-600">
            {t("sharedEndedBody")}
          </p>
          {joinResultMessageKey ? (
            <div className="mt-8 border border-stone-300 bg-[#fbf8f3] p-5 text-sm leading-6 text-stone-700">
              {t(joinResultMessageKey)}
            </div>
          ) : null}
          <Link
            href={`/${locale}/book`}
            className="mt-10 inline-flex border border-stone-950 bg-stone-950 px-8 py-4 text-xs font-medium uppercase tracking-[0.22em] text-[#f3eee7] transition hover:bg-transparent hover:text-stone-950"
          >
            {t("sharedEndedButton")}
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f3eee7] text-stone-950">
      <SiteHeader brand={common("brand")} locale={locale} path="/shared" />
      <section className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:py-24">
        <div className="border-t border-stone-300 pt-8">
          <Link
            href={`/${locale}`}
            className="text-xs uppercase tracking-[0.22em] text-stone-500 hover:text-stone-950"
          >
            {common("home")}
          </Link>
          <p className="mt-12 text-xs uppercase tracking-[0.22em] text-stone-500">
            {t("eyebrow")}
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-light leading-tight tracking-[-0.03em] sm:text-6xl">
            {t("title")}
          </h1>
          <p className="mt-6 max-w-2xl text-lg font-light leading-8 text-stone-600">
            {t(statusMessageKey)}
          </p>
          {joinResultMessageKey ? (
            <div className="mt-8 border border-stone-300 bg-[#fbf8f3] p-5 text-sm leading-6 text-stone-700">
              {t(joinResultMessageKey)}
            </div>
          ) : null}
        </div>

        <div className="bg-[#fbf8f3] p-6 shadow-sm sm:p-10">
          <h2 className="text-2xl font-light tracking-[-0.03em]">
            {t("detailsTitle")}
          </h2>
          <div className="mt-5 grid gap-x-6 sm:grid-cols-2">
            <DetailItem
              label={t("date")}
              value={formatCustomerDate(booking.requested_date, locale)}
            />
            <DetailItem label={t("time")} value={displayTime} />
            <DetailItem label={t("tour")} value={tourTypeLabel} />
            <DetailItem
              label={t("mainGroupGuests")}
              value={booking.guest_count}
            />
            <DetailItem
              label={t("openSeats")}
              value={booking.shared_open_seats}
            />
            <DetailItem
              label={t("maxCapacity")}
              value={MAX_BOAT_CAPACITY}
            />
            <DetailItem
              label={t("payOnBoard")}
              value={formatSharedPayOnBoardSplit(booking.pay_on_board_eur)}
            />
            <DetailItem
              label={t("genderPreferenceLabel")}
              value={genderPreferenceLabel}
            />
            <DetailItem label={t("status")} value={t(statusMessageKey)} />
          </div>

          {isJoinable ? (
            <SharedJoinRequestForm
              genderOptions={genderOptions}
              labels={getJoinFormLabels({ booking, policyT, t })}
              locale={locale}
              maxGuests={maxJoinGuests}
              sharedRequestFeeEur={sharedRequestFeeEur}
              token={cleanToken}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}
