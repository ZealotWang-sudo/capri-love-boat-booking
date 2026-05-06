"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import AdminWarningModal from "@/app/admin/AdminWarningModal";
import { cancelCustomerBooking } from "@/app/[locale]/booking/manage/[id]/actions";

function SubmitButton({ label }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-red-900/40 px-5 py-3 text-xs font-medium uppercase tracking-[0.18em] text-red-900 transition hover:border-red-900 hover:bg-red-900 hover:text-[#f3eee7] disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? label.pending : label.default}
    </button>
  );
}

export default function CustomerCancelBookingForm({
  bookingId,
  labels,
  locale,
  token,
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <form action={cancelCustomerBooking}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="token" value={token} />
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full border border-red-900/40 px-6 py-4 text-xs font-medium uppercase tracking-[0.2em] text-red-900 transition hover:border-red-900 hover:bg-red-900 hover:text-[#f3eee7] sm:w-auto"
      >
        {labels.cancelButton}
      </button>
      <AdminWarningModal
        cancelLabel={labels.keepButton}
        extraContent={
          <div>
            <label
              htmlFor="customerCancelReason"
              className="block text-xs uppercase tracking-[0.18em] text-stone-500"
            >
              {labels.reasonLabel}
            </label>
            <textarea
              id="customerCancelReason"
              name="customerCancelReason"
              placeholder={labels.reasonPlaceholder}
              className="mt-3 min-h-28 w-full border border-stone-300 bg-transparent px-4 py-3 text-sm outline-none transition focus:border-stone-950"
            />
          </div>
        }
        message={labels.confirmMessage}
        onCancel={() => setIsOpen(false)}
        open={isOpen}
        title={labels.cancelTitle}
      >
        <SubmitButton
          label={{
            default: labels.confirmButton,
            pending: labels.cancellingButton,
          }}
        />
      </AdminWarningModal>
    </form>
  );
}
