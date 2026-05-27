"use client";

import { useState } from "react";
import AdminNotice from "./AdminNotice";
import { sendCaptainWhatsappBookingAction } from "./actions";

export default function SendCaptainWhatsAppButton({ bookingId }) {
  const [status, setStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const isSending = status === "sending";

  async function handleSend() {
    try {
      setStatus("sending");
      setErrorMessage("");
      await sendCaptainWhatsappBookingAction({ bookingId });
      setStatus("sent");
    } catch (error) {
      setStatus("failed");
      setErrorMessage(
        error instanceof Error && error.message
          ? error.message
          : "Could not send WhatsApp to captain.",
      );
    }
  }

  return (
    <>
      {status === "sent" ? (
        <AdminNotice>WhatsApp availability request sent to captain.</AdminNotice>
      ) : null}
      {status === "failed" ? (
        <AdminNotice tone="error">{errorMessage}</AdminNotice>
      ) : null}
      <button
        type="button"
        onClick={handleSend}
        disabled={isSending}
        aria-busy={isSending}
        className="border border-stone-950 px-3 py-2 text-[0.65rem] font-medium uppercase tracking-[0.18em] text-stone-950 transition hover:bg-stone-950 hover:text-[#f3eee7] disabled:cursor-wait disabled:opacity-60"
      >
        {isSending ? (
          <span className="inline-flex items-center justify-center gap-2">
            <span
              aria-hidden="true"
              className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"
            />
            Sending...
          </span>
        ) : status === "sent" ? (
          "Sent"
        ) : (
          "Send WhatsApp to Captain"
        )}
      </button>
    </>
  );
}
