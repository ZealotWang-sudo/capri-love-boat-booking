"use client";

import { useState } from "react";
import AdminDropdownSelect from "./AdminDropdownSelect";
import AdminStatusActionButton from "./AdminStatusActionButton";
import AdminWarningModal from "./AdminWarningModal";
import {
  captureAuthorizedBookingPaymentAction,
  cancelAcceptedSharedJoinRequestAction,
  cancelPrimaryAndPromoteSharedJoinRequestAction,
  deleteClosedBooking,
  refundCapturedBookingPayment,
  releaseAuthorizedBookingPaymentAction,
  rescheduleBookingAction,
  updateBookingOperationalStatus,
} from "./actions";

function getServerAction(actionType) {
  if (actionType === "delete") {
    return deleteClosedBooking;
  }

  if (actionType === "refund") {
    return refundCapturedBookingPayment;
  }

  if (actionType === "capture") {
    return captureAuthorizedBookingPaymentAction;
  }

  if (actionType === "release") {
    return releaseAuthorizedBookingPaymentAction;
  }

  if (actionType === "cancelSharedSecondary") {
    return cancelAcceptedSharedJoinRequestAction;
  }

  if (actionType === "cancelSharedPrimaryPromote") {
    return cancelPrimaryAndPromoteSharedJoinRequestAction;
  }

  if (actionType === "reschedule") {
    return rescheduleBookingAction;
  }

  return updateBookingOperationalStatus;
}

export default function AdminActionForm({
  actionType = "status",
  bookingId,
  cancellationTypeDefault,
  cancellationTypeFieldName,
  cancellationTypeLabel,
  cancellationTypeOptions = [],
  confirmLabel = "Yes, continue",
  confirmMessage,
  confirmTitle,
  label,
  reasonFieldName,
  reasonLabel,
  reasonPlaceholder,
  reasonRequired = false,
  releaseOutcome,
  requestId,
  rescheduleDateDefault,
  rescheduleDateFieldName,
  timeSlotDefault,
  timeSlotFieldName,
  timeSlotLabel,
  timeSlotOptions = [],
  statusAction,
  variant,
  warningNotice,
}) {
  const [warningOpen, setWarningOpen] = useState(false);
  const serverAction = getServerAction(actionType);

  return (
    <form action={serverAction}>
      <input type="hidden" name="bookingId" value={bookingId} />
      {requestId ? <input type="hidden" name="requestId" value={requestId} /> : null}
      {statusAction ? (
        <input type="hidden" name="statusAction" value={statusAction} />
      ) : null}
      {releaseOutcome ? (
        <input type="hidden" name="releaseOutcome" value={releaseOutcome} />
      ) : null}
      {cancellationTypeDefault ? (
        <input
          type="hidden"
          name={cancellationTypeFieldName}
          value={cancellationTypeDefault}
        />
      ) : null}
      <AdminStatusActionButton
        type={confirmMessage ? "button" : "submit"}
        variant={variant}
        onClick={
          confirmMessage
            ? () => {
                setWarningOpen(true);
              }
            : undefined
        }
      >
        {label}
      </AdminStatusActionButton>
      <AdminWarningModal
        extraContent={
          reasonFieldName ||
          cancellationTypeFieldName ||
          rescheduleDateFieldName ||
          timeSlotFieldName ||
          warningNotice ? (
            <div className="space-y-5">
              {warningNotice ? (
                <p className="border border-red-900/30 p-3 text-sm leading-6 text-red-900">
                  {warningNotice}
                </p>
              ) : null}
              {rescheduleDateFieldName ? (
                <div>
                  <label
                    htmlFor={`${bookingId}-${rescheduleDateFieldName}`}
                    className="block text-xs uppercase tracking-[0.18em] text-stone-500"
                  >
                    New date
                  </label>
                  <input
                    id={`${bookingId}-${rescheduleDateFieldName}`}
                    type="date"
                    name={rescheduleDateFieldName}
                    defaultValue={rescheduleDateDefault}
                    required
                    className="mt-3 w-full border border-stone-300 bg-transparent px-4 py-3 text-sm outline-none transition focus:border-stone-950"
                  />
                </div>
              ) : null}
              {timeSlotFieldName ? (
                <AdminDropdownSelect
                  defaultValue={timeSlotDefault}
                  label={timeSlotLabel}
                  name={timeSlotFieldName}
                  options={timeSlotOptions}
                  placeholder="Choose a new time"
                />
              ) : null}
              {cancellationTypeFieldName && !cancellationTypeDefault ? (
                <AdminDropdownSelect
                  label={cancellationTypeLabel}
                  name={cancellationTypeFieldName}
                  options={cancellationTypeOptions}
                  placeholder="Choose a reason type"
                />
              ) : null}
              {reasonFieldName ? (
                <div>
                  <label
                    htmlFor={`${bookingId}-${reasonFieldName}`}
                    className="block text-xs uppercase tracking-[0.18em] text-stone-500"
                  >
                    {reasonLabel}
                  </label>
                  <textarea
                    id={`${bookingId}-${reasonFieldName}`}
                    name={reasonFieldName}
                    required={reasonRequired}
                    placeholder={reasonPlaceholder}
                    className="mt-3 min-h-28 w-full border border-stone-300 bg-transparent px-4 py-3 text-sm outline-none transition focus:border-stone-950"
                  />
                </div>
              ) : null}
            </div>
          ) : null
        }
        message={confirmMessage}
        onCancel={() => setWarningOpen(false)}
        open={warningOpen}
        title={confirmTitle}
      >
        <AdminStatusActionButton
          variant={variant === "danger" ? "danger" : "primary"}
        >
          {confirmLabel}
        </AdminStatusActionButton>
      </AdminWarningModal>
    </form>
  );
}
