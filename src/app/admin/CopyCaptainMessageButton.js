"use client";

import { useState } from "react";
import AdminNotice from "./AdminNotice";
import { markCaptainMessageCopiedAction } from "./actions";

export default function CopyCaptainMessageButton({
  bookingId,
  initialCopied = false,
  message,
  messageType,
}) {
  const [status, setStatus] = useState("idle");
  const [isCopied, setIsCopied] = useState(initialCopied);
  const isCopying = status === "copying";

  async function handleCopy() {
    try {
      setStatus("copying");
      await navigator.clipboard.writeText(message);
      if (bookingId && messageType) {
        await markCaptainMessageCopiedAction({ bookingId, messageType });
      }
      setIsCopied(true);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <>
      {status === "copied" ? (
        <AdminNotice>
          Captain message copied{bookingId ? " and marked as sent" : ""}.
        </AdminNotice>
      ) : null}
      {status === "failed" ? (
        <AdminNotice tone="error">
          Could not copy the captain message. Please try again.
        </AdminNotice>
      ) : null}
      <button
        type="button"
        onClick={handleCopy}
        disabled={isCopying}
        aria-busy={isCopying}
        className="border border-stone-950 px-3 py-2 text-[0.65rem] font-medium uppercase tracking-[0.18em] text-stone-950 transition hover:bg-stone-950 hover:text-[#f3eee7] disabled:cursor-wait disabled:opacity-60"
      >
        {isCopying ? (
          <span className="inline-flex items-center justify-center gap-2">
            <span
              aria-hidden="true"
              className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"
            />
            Copying...
          </span>
        ) : status === "copied" ? (
          "Copied"
        ) : status === "failed" ? (
          "Copy failed"
        ) : isCopied ? (
          "Copy again"
        ) : (
          "Copy message"
        )}
      </button>
    </>
  );
}
