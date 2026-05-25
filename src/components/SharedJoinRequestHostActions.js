"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { respondToSharedJoinRequest } from "@/app/[locale]/booking/manage/[id]/actions";

function SubmitButton({ children, disabled, pendingLabel, variant }) {
  const { pending } = useFormStatus();
  const isDisabled = pending || disabled;
  const className =
    variant === "danger"
      ? "border border-red-900/40 px-5 py-3 text-xs font-medium uppercase tracking-[0.18em] text-red-900 transition hover:border-red-900 hover:bg-red-900 hover:text-[#f3eee7] disabled:cursor-wait disabled:opacity-60"
      : "border border-stone-950 bg-stone-950 px-5 py-3 text-xs font-medium uppercase tracking-[0.18em] text-[#f3eee7] transition hover:bg-transparent hover:text-stone-950 disabled:cursor-wait disabled:opacity-60";

  return (
    <button type="submit" disabled={isDisabled} className={className}>
      <span className="inline-flex items-center gap-2">
        {pending ? (
          <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
        ) : null}
        {pending ? pendingLabel : children}
      </span>
    </button>
  );
}

export default function SharedJoinRequestHostActions({
  acceptLabel,
  acceptPendingLabel,
  bookingId,
  locale,
  rejectLabel,
  rejectPendingLabel,
  requestId,
  token,
}) {
  const [submittingAction, setSubmittingAction] = useState("");

  return (
    <div className="mt-5 flex flex-wrap gap-3">
      <form
        action={respondToSharedJoinRequest}
        onSubmit={() => setSubmittingAction("accept")}
      >
        <input type="hidden" name="bookingId" value={bookingId} />
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="response" value="accept" />
        <input type="hidden" name="token" value={token} />
        <SubmitButton
          disabled={submittingAction === "reject"}
          pendingLabel={acceptPendingLabel}
        >
          {acceptLabel}
        </SubmitButton>
      </form>
      <form
        action={respondToSharedJoinRequest}
        onSubmit={() => setSubmittingAction("reject")}
      >
        <input type="hidden" name="bookingId" value={bookingId} />
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="response" value="reject" />
        <input type="hidden" name="token" value={token} />
        <SubmitButton
          disabled={submittingAction === "accept"}
          pendingLabel={rejectPendingLabel}
          variant="danger"
        >
          {rejectLabel}
        </SubmitButton>
      </form>
    </div>
  );
}
