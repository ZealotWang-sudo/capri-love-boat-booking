"use client";

import { useState } from "react";
import AdminActionForm from "./AdminActionForm";
import CopyCaptainMessageButton from "./CopyCaptainMessageButton";
import CopySharedLinkButton from "@/components/CopySharedLinkButton";
import {
  getDisplayTimeForTimeSlot,
  getValidTimeSlotsForTour,
} from "@/lib/bookingAvailability";

const STATUS_ACTIONS = [
  {
    value: "checking_with_captain",
    label: "Contact captain",
    confirmMessage: "Mark this booking as checking with captain?",
    confirmTitle: "Update booking status?",
    showWhen: { booking_status: "requested", payment_status: "unpaid" },
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
      payment_status: "unpaid",
    },
  },
  {
    actionType: "capture",
    id: "capture_authorized_payment",
    label: "Captain available",
    confirmMessage:
      "Capture the authorized reservation fee and confirm this booking?",
    confirmTitle: "Capture payment and confirm?",
    showWhen: {
      booking_status: "checking_with_captain",
      captain_status: "pending",
      payment_status: "authorized",
    },
    variant: "primary",
    warningNotice:
      "This captures the Stripe authorization. The booking will only be marked confirmed after Stripe capture succeeds.",
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
    showWhen: {
      booking_status: "checking_with_captain",
      payment_status: "unpaid",
    },
    variant: "danger",
  },
  {
    actionType: "release",
    id: "release_not_available",
    label: "Captain not available — release authorization",
    confirmLabel: "Release authorization",
    confirmMessage:
      "Release the authorized reservation fee and mark the captain as not available?",
    confirmTitle: "Release authorization?",
    cancellationTypeDefault: "captain_unavailable",
    cancellationTypeFieldName: "cancellationType",
    reasonFieldName: "cancellationReason",
    reasonLabel: "Reason",
    reasonPlaceholder: "Tell the customer why this time is not available.",
    reasonRequired: true,
    releaseOutcome: "not_available",
    showWhen: {
      booking_status: "checking_with_captain",
      payment_status: "authorized",
    },
    variant: "danger",
    warningNotice:
      "This releases the Stripe authorization first. The customer is not charged.",
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
    actionType: "reschedule",
    id: "reschedule_booking",
    label: "Reschedule booking",
    confirmLabel: "Save new date and time",
    confirmMessage:
      "Move this booking to a different date and time? Payment and confirmation status will stay unchanged.",
    confirmTitle: "Reschedule booking?",
    rescheduleDateFieldName: "requestedDate",
    timeSlotFieldName: "timeSlot",
    timeSlotLabel: "New time",
    showWhen: { booking_status: "confirmed" },
    variant: "primary",
    warningNotice:
      "This checks for overlaps with other active bookings before saving.",
  },
  {
    value: "cancelled",
    label: "Cancel request",
    cancellationTypeDefault: "admin_decision",
    cancellationTypeFieldName: "cancellationType",
    cancellationTypeLabel: "Cancellation type",
    confirmMessage: "Cancel this booking request?",
    confirmTitle: "Cancel this booking?",
    reasonFieldName: "cancellationReason",
    reasonLabel: "Reason for cancellation",
    reasonPlaceholder: "Optional note to include in the customer email.",
    showWhenStatuses: ["requested", "payment_pending"],
    variant: "danger",
  },
  {
    actionType: "release",
    id: "release_cancelled",
    label: "Cancel request — release authorization",
    cancellationTypeFieldName: "cancellationType",
    cancellationTypeLabel: "Cancellation type",
    confirmLabel: "Release and cancel",
    confirmMessage:
      "Release the authorized reservation fee and cancel this request?",
    confirmTitle: "Cancel authorized request?",
    reasonFieldName: "cancellationReason",
    reasonLabel: "Reason for cancellation",
    reasonPlaceholder: "Optional note to include in the customer email.",
    releaseOutcome: "cancelled",
    showWhen: {
      booking_status: "checking_with_captain",
      payment_status: "authorized",
    },
    variant: "danger",
    warningNotice:
      "This releases the Stripe authorization first. The customer is not charged.",
  },
  {
    value: "cancelled",
    label: "Cancel booking",
    cancellationTypeDefault: "admin_decision",
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
      "Reservation fee has already been paid. Cancelling this booking will automatically start Stripe refunds for the main booking and any accepted shared join request before customer emails are sent.",
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
    showWhenPaymentStatuses: ["authorization_pending", "failed"],
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

function CollapsibleSection({
  children,
  defaultOpen = false,
  description,
  title,
}) {
  const [isExpanded, setIsExpanded] = useState(defaultOpen);

  return (
    <section className="border-t border-stone-300 py-4">
      <div className="flex items-start justify-between gap-4 ">
        <button
          type="button"
          onClick={() => setIsExpanded((expanded) => !expanded)}
          className="flex min-w-0 flex-1 items-start justify-between gap-4 text-left"
        >
          <span>
            <span className="block text-xs uppercase tracking-[0.18em] text-stone-100 bg-stone-500 px-2 py-1 rounded-md">
              {title}
            </span>
            {description ? (
              <span className="mt-1 block text-xs leading-5 text-stone-500">
                {description}
              </span>
            ) : null}
          </span>
          <span className="shrink-0 text-[0.65rem] uppercase tracking-[0.16em] text-stone-500">
            {isExpanded ? "Hide" : "Show"}
          </span>
        </button>
      </div>
      {isExpanded ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}

function DetailGrid({ children }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

function getSharedGuestManagePath(request) {
  if (!request.customer_manage_token) {
    return "";
  }

  return `/${request.locale}/shared/manage/${request.id}?token=${encodeURIComponent(
    request.customer_manage_token,
  )}`;
}

function canShowConnectedSharedAdminActions({ booking, request }) {
  return (
    booking.booking_status === "confirmed" &&
    booking.payment_status === "captured" &&
    booking.shared_status === "connected" &&
    booking.is_shared_open &&
    request.status === "accepted" &&
    request.payment_status === "captured"
  );
}

function SharedAdminCancellationActions({ booking, request }) {
  if (!canShowConnectedSharedAdminActions({ booking, request })) {
    return null;
  }

  return (
    <div className="mt-5 border-t border-stone-300 pt-5">
      <p className="text-[0.65rem] uppercase tracking-[0.16em] text-stone-500">
        Connected shared cancellation
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <AdminActionForm
          actionType="cancelSharedSecondary"
          bookingId={booking.id}
          confirmLabel="Refund secondary"
          confirmMessage="Cancel only this secondary request? The joining group's prepayment will be refunded, the primary booking stays confirmed, and the shared link reopens."
          confirmTitle="Cancel secondary request?"
          label="Cancel secondary request"
          requestId={request.id}
          variant="danger"
          warningNotice="Use this when the joining group should be removed but the original primary booking should continue. Both groups will be emailed."
        />
        <AdminActionForm
          actionType="cancelSharedPrimaryPromote"
          bookingId={booking.id}
          confirmLabel="Refund primary and promote"
          confirmMessage="Cancel the original primary group and promote this secondary group into the main booking? The original primary prepayment will be refunded. This group's captured prepayment will be kept as the booking prepayment."
          confirmTitle="Promote secondary to primary?"
          label="Cancel primary and promote"
          reasonFieldName="cancellationReason"
          reasonLabel="Reason for primary cancellation"
          reasonPlaceholder="Optional note to include in the original primary customer's email."
          requestId={request.id}
          variant="danger"
          warningNotice="This keeps the same booking date and share link, but replaces the main customer details with this secondary group and reopens sharing."
        />
      </div>
    </div>
  );
}

function SharedRequestDebugCard({ booking, request }) {
  const guestManagePath = getSharedGuestManagePath(request);

  return (
    <article className="border border-stone-300 bg-[#fbf8f3] p-4">
      {guestManagePath ? (
        <div className="mb-4 flex justify-end">
          <ManageBookingButton
            label="Open guest summary"
            path={guestManagePath}
          />
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <DetailItem label="Request ID" value={request.id} />
        <DetailItem label="Created" value={request.created_at} />
        <DetailItem label="Updated" value={request.updated_at} />
        <DetailItem label="Locale" value={request.locale} />
        <DetailItem label="Name" value={request.customer_name} />
        <DetailItem label="Email" value={request.email} />
        <DetailItem label="Phone" value={request.phone} />
        <DetailItem label="WhatsApp" value={request.whatsapp} />
        <DetailItem label="WeChat" value={request.wechat} />
        <DetailItem
          label="Preferred contact"
          value={request.preferred_contact_method}
        />
        <DetailItem label="Guests" value={request.guest_count} />
        <DetailItem label="Gender" value={request.gender_composition} />
        <DetailItem label="Status" value={request.status} />
        <DetailItem label="Payment status" value={request.payment_status} />
        <DetailItem
          label="Original request fee"
          value={formatEuro(request.original_shared_request_fee_eur)}
        />
        <DetailItem label="Promo code" value={request.promo_code} />
        <DetailItem
          label="Promo discount"
          value={formatDiscount(request.promo_discount_eur)}
        />
        <DetailItem
          label="Final request fee"
          value={formatEuro(request.shared_request_fee_eur)}
        />
        <DetailItem
          label="Consent accepted"
          value={request.consent_accepted ? "yes" : "no"}
        />
        <DetailItem label="Authorized at" value={request.authorized_at} />
        <DetailItem
          label="Host deadline"
          value={request.host_response_deadline_at}
        />
        <DetailItem
          label="Payment intent"
          value={request.stripe_payment_intent_id}
        />
        <DetailItem
          label="Checkout session"
          value={request.stripe_checkout_session_id}
        />
      </div>
      <div className="mt-4">
        <p className="text-[0.65rem] uppercase tracking-[0.16em] text-stone-500">
          Message
        </p>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-stone-700">
          {formatValue(request.message)}
        </p>
      </div>
      <SharedAdminCancellationActions booking={booking} request={request} />
    </article>
  );
}

function ManageBookingButton({ label = "Open manage page", path }) {
  if (!path) {
    return <DetailItem label="Manage booking" value={null} />;
  }

  function handleOpenManageBooking() {
    window.open(`${window.location.origin}${path}`, "_blank", "noreferrer");
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleOpenManageBooking}
        className="mt-2 border border-stone-950 px-3 py-2 text-[0.65rem] font-medium uppercase tracking-[0.16em] text-stone-950 transition hover:bg-stone-950 hover:text-[#f3eee7]"
      >
        {label}
      </button>
    </div>
  );
}

function getSharedPublicPath(booking) {
  if (!booking.locale || !booking.shared_public_token) {
    return "";
  }

  return `/${booking.locale}/shared/${booking.shared_public_token}`;
}

function getRescheduleTimeSlotOptions(booking) {
  return getValidTimeSlotsForTour(booking.tour_type).map((timeSlot) => ({
    label: getDisplayTimeForTimeSlot(timeSlot) || timeSlot,
    value: timeSlot,
  }));
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
      releaseOutcome={action.releaseOutcome}
      rescheduleDateDefault={booking.requested_date}
      rescheduleDateFieldName={action.rescheduleDateFieldName}
      statusAction={action.value}
      timeSlotDefault={booking.time_slot}
      timeSlotFieldName={action.timeSlotFieldName}
      timeSlotLabel={action.timeSlotLabel}
      timeSlotOptions={
        action.actionType === "reschedule"
          ? getRescheduleTimeSlotOptions(booking)
          : undefined
      }
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
    booking.payment_status === "authorization_pending" &&
    action.actionType !== "delete"
  ) {
    return false;
  }

  if (
    action.requiresStripePaymentRecord &&
    !booking.stripe_payment_intent_id &&
    !booking.stripe_checkout_session_id
  ) {
    return false;
  }

  if (!action.showWhen) {
    return Boolean(
      action.showWhenStatuses?.includes(booking.booking_status) ||
        action.showWhenPaymentStatuses?.includes(booking.payment_status) ||
        (!action.showWhenStatuses && !action.showWhenPaymentStatuses),
    );
  }

  return Object.entries(action.showWhen).every(
    ([fieldName, value]) => booking[fieldName] === value,
  );
}

export default function AdminBookingDetails({ booking, captainMessage }) {
  const [isOpen, setIsOpen] = useState(false);
  const whatsappHref = getWhatsappHref(booking.phone);
  const sharedJoinRequests = Array.isArray(booking.shared_join_requests)
    ? booking.shared_join_requests
    : [];
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
            <div className="flex items-start justify-between gap-6  border-stone-300 pb-5">
              <div className="">
                <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
                  Booking details
                </p>
                <div className="flex flex justify-between ">

                <div className="flex flex-col ">
                <h2 className="mt-3 text-3xl font-light tracking-[-0.03em]">
                  {formatValue(booking.customer_name)}
                </h2>
                <p className="mt-2 text-sm uppercase tracking-[0.16em] text-stone-500">
                  {formatValue(booking.reference_code)}
                </p>
                </div>

                </div>
              </div>

              <div className="flex flex-col items-end justify-end gap-2 ">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs uppercase tracking-[0.18em] text-stone-500 hover:text-stone-950"
              >
                Close
              </button>
              <ManageBookingButton path={booking.manage_path} />
              </div>
            </div>

            <div className="mt-4">
              <CollapsibleSection title="Trip">
                <DetailGrid>
                <DetailItem label="Reference" value={booking.reference_code} />
                <DetailItem label="Date" value={booking.requested_date} />
                <DetailItem
                  label="Time"
                  value={booking.time_window || booking.time_slot}
                />
                <DetailItem label="Tour" value={booking.tour_label} />
                <DetailItem label="Guests" value={booking.guest_count} />
                <DetailItem label="Language" value={booking.locale} />
                </DetailGrid>
              </CollapsibleSection>

              <CollapsibleSection title="Contact">
                <DetailGrid>
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

                </DetailGrid>
                <div className="mt-5 border-t border-stone-300 pt-5">
                  <p className="text-[0.65rem] uppercase tracking-[0.16em] text-stone-500">
                    Customer message
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-700">
                    {formatValue(booking.message)}
                  </p>
                </div>
              </CollapsibleSection>

              <CollapsibleSection title="Price">
                <DetailGrid>
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
                  label="Final reservation fee"
                  value={formatEuro(
                    booking.final_reservation_fee_eur ??
                      booking.reservation_fee_eur,
                  )}
                />
                <DetailItem
                  label="Pay on site"
                  value={formatEuro(booking.pay_on_board_eur)}
                />
                </DetailGrid>
              </CollapsibleSection>

              <CollapsibleSection title="Status">
                <DetailGrid>
                <DetailItem
                  label="Booking"
                  value={booking.booking_status_display ?? booking.booking_status}
                />
                <DetailItem label="Payment" value={booking.payment_status} />
                <DetailItem label="Captain" value={booking.captain_status} />
                </DetailGrid>
                <div className="mt-5 flex flex-col gap-3 border-t border-stone-300 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[0.65rem] uppercase tracking-[0.16em] text-stone-500">
                      Captain message
                    </p>
                    <p className="mt-1 text-sm text-stone-600">
                      {booking.captain_message_state?.label
                        ? booking.captain_message_state.label
                        : "Generated Italian message"}
                    </p>
                  </div>
                  <CopyCaptainMessageButton
                    bookingId={booking.id}
                    initialCopied={booking.captain_message_state?.copied}
                    message={captainMessage}
                    messageType={booking.captain_message_state?.messageType}
                  />
                </div>
              </CollapsibleSection>

              <CollapsibleSection title="Shared boat">

                <DetailGrid>
                <DetailItem
                  label="Shared enabled"
                  value={booking.is_shared_open ? "true" : "false"}
                />
                <DetailItem label="Shared status" value={booking.shared_status} />
                <DetailItem
                  label="Open seats"
                  value={booking.shared_open_seats}
                />
                <DetailItem
                  label="Gender preference"
                  value={booking.shared_gender_preference}
                />
                <DetailItem
                  label="Max join groups"
                  value={booking.shared_max_join_groups}
                />
                {/* <DetailItem
                  label="Public token"
                  value={booking.shared_public_token}
                /> */}
                </DetailGrid>
                {booking.is_shared_open && booking.shared_public_token ? (
                  <div className="mb-5 mt-5">
                    <p className="text-[0.65rem] uppercase tracking-[0.16em] text-stone-500">
                      Share link
                    </p>
                    <CopySharedLinkButton
                      label="Copy shared link"
                      path={getSharedPublicPath(booking)}
                    />
                  </div>
                ) : null}
              <div className="mt-6 border-t border-stone-300 pt-5">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  Shared join requests
                </p>
              {sharedJoinRequests.length > 0 ? (
                <div className="mt-4 space-y-4">
                  {sharedJoinRequests.map((request) => (
                    <SharedRequestDebugCard
                      key={request.id}
                      booking={booking}
                      request={request}
                    />
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-stone-500">
                  No shared join requests for this booking.
                </p>
              )}
              </div>
              </CollapsibleSection>

              <CollapsibleSection title="Stripe">
                <DetailGrid>
                <DetailItem
                  label="Payment intent"
                  value={booking.stripe_payment_intent_id}
                />
                <DetailItem
                  label="Checkout session"
                  value={booking.stripe_checkout_session_id}
                />
                </DetailGrid>
              </CollapsibleSection>
            </div>

            {showCancellationDetails ? (
              <CollapsibleSection title="Cancellation">
                <DetailGrid>
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
                </DetailGrid>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-700">
                  {formatValue(
                    booking.cancellation_reason || booking.customer_cancel_reason,
                  )}
                </p>
              </CollapsibleSection>
            ) : null}

            <CollapsibleSection title="Manual actions">
              {availableActions.length > 0 ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {availableActions.map((action) => (
                    <StatusActionForm
                      key={action.id ?? action.value ?? action.actionType}
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
            </CollapsibleSection>
          </div>
        </div>
      ) : null}
    </>
  );
}
