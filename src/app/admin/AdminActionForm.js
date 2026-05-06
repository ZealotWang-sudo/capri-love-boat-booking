"use client";

import { useState } from "react";
import AdminStatusActionButton from "./AdminStatusActionButton";
import AdminWarningModal from "./AdminWarningModal";
import {
  deleteClosedBooking,
  updateBookingOperationalStatus,
} from "./actions";

export default function AdminActionForm({
  actionType = "status",
  bookingId,
  confirmLabel = "Yes, continue",
  confirmMessage,
  confirmTitle,
  label,
  reasonFieldName,
  reasonLabel,
  reasonPlaceholder,
  reasonRequired = false,
  statusAction,
  variant,
}) {
  const [warningOpen, setWarningOpen] = useState(false);
  const serverAction =
    actionType === "delete" ? deleteClosedBooking : updateBookingOperationalStatus;

  return (
    <form action={serverAction}>
      <input type="hidden" name="bookingId" value={bookingId} />
      {statusAction ? (
        <input type="hidden" name="statusAction" value={statusAction} />
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
          reasonFieldName ? (
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
