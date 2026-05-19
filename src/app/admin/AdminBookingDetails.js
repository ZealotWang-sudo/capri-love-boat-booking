"use client";

import { useState } from "react";
import AdminActionForm from "./AdminActionForm";
import CopyCaptainMessageButton from "./CopyCaptainMessageButton";

const STATUS_ACTIONS = [
  {
    value: "checking_with_captain",
    label: "Contact captain",
    confirmMessage: "Mark this booking as checking with captain?",
    confirmTitle: "Update booking status?",
    showWhen: { booking_status: "requested" },
  },
  {
    value: "captain_available",
    label: "Captain available",
    confirmMessage:
      "Mark the captain as available and move this booking to payment pending?",
    confirmTitle: "Captain confirmed time?",
    showWhen: {
      booking_status: "checking_with_captain",
      captain_status: "pending",
    },
  },
  {
    value: "captain_not_available",
    label: "Captain not available",
    confirmMessage: "Mark this booking as not available?",
    confirmTitle: "Captain not available?",
    cancellationTypeDefault: "captain_unavailable",
    cancellationTypeFieldName: "cancellationType",
    reasonFieldName: "cancellationReason",
    reasonLabel: "Reason",
    reasonPlaceholder: "Tell the customer why this time is not available.",
    reasonRequired: true,
    showWhen: { booking_status: "checking_with_captain" },
    variant: "danger",
  },
  {
    value: "confirmed",
    label: "Mark confirmed manually",
    confirmMessage: "Confirm this booking and mark payment as captured?",
    confirmTitle: "Confirm this booking?",
    showWhen: { booking_status: "payment_pending" },
    variant: "primary",
  },
  {
    value: "completed",
    label: "Mark trip completed",
    confirmMessage: "Mark this confirmed trip as completed?",
    confirmTitle: "Complete this trip?",
    showWhen: { booking_status: "confirmed" },
  },
  {
    value: "cancelled",
    label: "Cancel request",
    cancellationTypeFieldName: "cancellationType",
    cancellationTypeLabel: "Cancellation type",
    confirmMessage: "Cancel this booking request?",
    confirmTitle: "Cancel this booking?",
    reasonFieldName: "cancellationReason",
    reasonLabel: "Reason for cancellation",
    reasonPlaceholder: "Optional note to include in the customer email.",
    showWhenStatuses: ["requested", "checking_with_captain", "payment_pending"],
    variant: "danger",
  },
  {
    value: "cancelled",
    label: "Cancel booking",
    cancellationTypeFieldName: "cancellationType",
    cancellationTypeLabel: "Cancellation type",
    confirmLabel: "Cancel booking",
    confirmMessage:
      "Cancel this confirmed booking? The customer will receive a cancellation email.",
    confirmTitle: "Cancel confirmed booking?",
    reasonFieldName: "cancellationReason",
    reasonLabel: "Reason for cancellation",
    reasonPlaceholder: "Optional note to include in the customer email.",
    refundWarning:
      "Reservation fee has already been paid. Use the refund button separately if you also need to return the payment.",
    showWhen: { booking_status: "confirmed" },
    variant: "danger",
  },
  {
    actionType: "refund",
    label: "Refund Stripe payment",
    confirmLabel: "Refund payment",
    confirmMessage:
      "Refund the reservation fee in Stripe and mark this booking payment as refunded? This does not cancel the booking.",
    confirmTitle: "Refund reservation fee?",
    requiresStripePaymentRecord: true,
    showWhen: { payment_status: "captured" },
    variant: "danger",
    warningNotice:
      "This creates a real Stripe refund for the captured reservation fee. Use the cancel action separately if the booking should also be cancelled.",
  },
  {
    actionType: "delete",
    label: "Delete booking",
    confirmLabel: "Delete permanently",
    confirmMessage:
      "Permanently delete this closed booking from the admin list? This cannot be undone.",
    confirmTitle: "Delete this booking?",
    showWhenStatuses: ["completed", "cancelled", "not_available", "expired"],
    variant: "danger",
  },
];
const CANCELLATION_TYPE_OPTIONS = [
  { label: "Customer requested", value: "customer_requested" },
  { label: "Captain unavailable", value: "captain_unavailable" },
  { label: "Weather or safety", value: "weather_or_safety" },
  { label: "Admin decision", value: "admin_decision" },
  { label: "Duplicate or test", value: "duplicate_or_test" },
  { label: "Other", value: "other" },
];

function formatValue(value) {
  return value || "-";
}

function formatEuro(value) {
  return typeof value === "number" ? `€${value}` : "-";
}

function formatDiscount(value) {
  return typeof value === "number" && value > 0 ? `-€${value}` : "—";
}

function getWhatsappHref(phone) {
  if (!phone) {
    return null;
  }

  const digits = phone.replace(/\D/g, "");

  if (digits.length < 6 || digits.length > 15) {
    return null;
  }

  return `https://wa.me/${digits}`;
}

function DetailItem({ label, value }) {
  return (
    <div>
      <p className="text-[0.65rem] uppercase tracking-[0.16em] text-stone-500">
        {label}
      </p>
      <p className="mt-1 break-all text-sm text-stone-950">
        {formatValue(value)}
      </p>
    </div>
  );
}

function StatusActionForm({ action, booking }) {
  return (
    <AdminActionForm
      actionType={action.actionType}
      bookingId={booking.id}
      cancellationTypeDefault={action.cancellationTypeDefault}
      cancellationTypeFieldName={action.cancellationTypeFieldName}
      cancellationTypeLabel={action.cancellationTypeLabel}
      cancellationTypeOptions={CANCELLATION_TYPE_OPTIONS}
      confirmLabel={action.confirmLabel}
      confirmMessage={action.confirmMessage}
      confirmTitle={action.confirmTitle}
      label={action.label}
      reasonFieldName={action.reasonFieldName}
      reasonLabel={action.reasonLabel}
      reasonPlaceholder={action.reasonPlaceholder}
      reasonRequired={action.reasonRequired}
      statusAction={action.value}
      variant={action.variant}
      warningNotice={
        action.warningNotice ??
        (action.refundWarning && booking.payment_status === "captured"
          ? action.refundWarning
          : undefined)
      }
    />
  );
}

function shouldShowStatusAction(action, booking) {
  if (
    action.requiresStripePaymentRecord &&
    !booking.stripe_payment_intent_id &&
    !booking.stripe_checkout_session_id
  ) {
    return false;
  }

  if (!action.showWhen) {
    return action.showWhenStatuses
      ? action.showWhenStatuses.includes(booking.booking_status)
      : true;
  }

  return Object.entries(action.showWhen).every(
    ([fieldName, value]) => booking[fieldName] === value,
  );
}

export default function AdminBookingDetails({ booking, captainMessage }) {
  const [isOpen, setIsOpen] = useState(false);
  const whatsappHref = getWhatsappHref(booking.phone);
  const showCancellationDetails =
    booking.cancellation_reason ||
    booking.cancellation_type ||
    booking.cancelled_at ||
    booking.cancelled_by ||
    booking.customer_cancel_reason ||
    booking.customer_cancelled_at;
  const availableActions = STATUS_ACTIONS.filter((action) =>
    shouldShowStatusAction(action, booking),
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="border border-stone-300 px-3 py-2 text-[0.65rem] font-medium uppercase tracking-[0.16em] text-stone-700 transition hover:border-stone-950 hover:bg-stone-950 hover:text-[#f3eee7]"
      >
        Details
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/35 px-4 py-6">
          <div className="mx-auto max-w-3xl border border-stone-300 bg-[#f3eee7] p-5 text-stone-950 shadow-xl sm:p-8">
            <div className="flex items-start justify-between gap-6 border-b border-stone-300 pb-5">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
                  Booking details
                </p>
                <h2 className="mt-3 text-3xl font-light tracking-[-0.03em]">
                  {formatValue(booking.customer_name)}
                </h2>
                <p className="mt-2 text-sm uppercase tracking-[0.16em] text-stone-500">
                  {formatValue(booking.reference_code)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs uppercase tracking-[0.18em] text-stone-500 hover:text-stone-950"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <section className="space-y-4">
                <h3 className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  Trip
                </h3>
                <DetailItem label="Reference" value={booking.reference_code} />
                <DetailItem label="Date" value={booking.requested_date} />
                <DetailItem
                  label="Time"
                  value={booking.time_window || booking.time_slot}
                />
                <DetailItem label="Tour" value={booking.tour_label} />
                <DetailItem label="Guests" value={booking.guest_count} />
                <DetailItem label="Language" value={booking.locale} />
              </section>

              <section className="space-y-4">
                <h3 className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  Contact
                </h3>
                <DetailItem label="Email" value={booking.email} />
                <div>
                  <p className="text-[0.65rem] uppercase tracking-[0.16em] text-stone-500">
                    Phone
                  </p>
                  <p className="mt-1 text-sm text-stone-950">
                    {formatValue(booking.phone)}
                    {whatsappHref ? (
                      <>
                        {" "}
                        <a
                          href={whatsappHref}
                          target="_blank"
                          rel="noreferrer"
                          className="underline decoration-stone-400 underline-offset-4 hover:text-stone-600"
                        >
                          WhatsApp
                        </a>
                      </>
                    ) : null}
                  </p>
                </div>
                <DetailItem
                  label="Contact method"
                  value={booking.contact_method}
                />
              </section>

              <section className="space-y-4">
                <h3 className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  Price
                </h3>
                <DetailItem
                  label="Total"
                  value={formatEuro(booking.total_price_eur)}
                />
                <DetailItem
                  label="Original reservation fee"
                  value={formatEuro(
                    booking.original_reservation_fee_eur ??
                      booking.reservation_fee_eur,
                  )}
                />
                <DetailItem
                  label="Promo code used"
                  value={booking.promo_code}
                />
                <DetailItem
                  label="Promo discount"
                  value={formatDiscount(booking.promo_discount_eur)}
                />
                <DetailItem
                  label="Final reservation fee paid"
                  value={formatEuro(
                    booking.final_reservation_fee_eur ??
                      booking.reservation_fee_eur,
                  )}
                />
                <DetailItem
                  label="Pay on site"
                  value={formatEuro(booking.pay_on_board_eur)}
                />
              </section>

              <section className="space-y-4">
                <h3 className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  Status
                </h3>
                <DetailItem
                  label="Booking"
                  value={booking.booking_status_display ?? booking.booking_status}
                />
                <DetailItem label="Payment" value={booking.payment_status} />
                <DetailItem label="Captain" value={booking.captain_status} />
              </section>

              <section className="space-y-4">
                <h3 className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  Stripe
                </h3>
                <DetailItem
                  label="Payment intent"
                  value={booking.stripe_payment_intent_id}
                />
                <DetailItem
                  label="Checkout session"
                  value={booking.stripe_checkout_session_id}
                />
              </section>
            </div>

            <section className="mt-8 border-t border-stone-300 pt-6">
              <h3 className="text-xs uppercase tracking-[0.18em] text-stone-500">
                Customer message
              </h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-700">
                {formatValue(booking.message)}
              </p>
            </section>

            {showCancellationDetails ? (
              <section className="mt-8 border-t border-stone-300 pt-6">
                <h3 className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  Cancellation
                </h3>
                {booking.customer_cancelled_at ? (
                  <DetailItem
                    label="Cancelled by customer at"
                    value={booking.customer_cancelled_at}
                  />
                ) : null}
                {booking.cancelled_at ? (
                  <DetailItem label="Cancelled at" value={booking.cancelled_at} />
                ) : null}
                {booking.cancelled_by ? (
                  <DetailItem label="Cancelled by" value={booking.cancelled_by} />
                ) : null}
                {booking.cancellation_type ? (
                  <DetailItem
                    label="Cancellation type"
                    value={booking.cancellation_type}
                  />
                ) : null}
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-700">
                  {formatValue(
                    booking.cancellation_reason || booking.customer_cancel_reason,
                  )}
                </p>
              </section>
            ) : null}

            <section className="mt-8 grid gap-4 border-t border-stone-300 pt-6 sm:grid-cols-[1fr_auto] sm:items-start">
              <div>
                <h3 className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  Captain message
                </h3>
                <p className="mt-2 text-sm text-stone-600">
                  Copies the generated Italian message for the captain.
                </p>
              </div>
              <CopyCaptainMessageButton message={captainMessage} />
            </section>

            <section className="mt-8 border-t border-stone-300 pt-6">
              <h3 className="text-xs uppercase tracking-[0.18em] text-stone-500">
                Manual actions
              </h3>
              {availableActions.length > 0 ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {availableActions.map((action) => (
                    <StatusActionForm
                      key={action.value ?? action.actionType}
                      action={action}
                      booking={booking}
                    />
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-stone-500">
                  No manual action buttons for this booking.
                </p>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </>
  );
}
