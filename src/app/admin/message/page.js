import { redirect } from "next/navigation";
import {
  CAPTAIN_MESSAGE_TYPES,
  buildCaptainMessageByType,
} from "@/lib/admin/captainMessages";
import CopyCaptainMessageButton from "../CopyCaptainMessageButton";

const PREVIEW_BOOKING = {
  customer_name: "Kexin Wang",
  email: "guest@example.com",
  final_reservation_fee_eur: 70,
  guest_count: 2,
  id: "12345678-90ab-cdef-1234-567890abcdef",
  message: "We would love a swimming stop if the sea is calm.",
  pay_on_board_eur: 280,
  phone: "+39 339 665 0836",
  requested_date: "2026-05-19",
  reservation_fee_eur: 70,
  time_slot: "morning_0930",
  time_window: "09:30",
  total_price_eur: 350,
  tour_type: "three_hours",
};

const MESSAGE_PREVIEWS = [
  {
    description:
      "Use this after the customer authorizes the reservation fee and you need the captain to confirm the time.",
    message: buildCaptainMessageByType(
      PREVIEW_BOOKING,
      CAPTAIN_MESSAGE_TYPES.timeConfirmation,
    ),
    title: "Time confirmation",
  },
  {
    description:
      "Use this after the captain confirms availability and Stripe capture succeeds. This includes customer contact and pay-on-board details.",
    message: buildCaptainMessageByType(
      PREVIEW_BOOKING,
      CAPTAIN_MESSAGE_TYPES.finalConfirmation,
    ),
    title: "Final confirmation",
  },
  {
    description:
      "Use this when a confirmed or held booking is cancelled and the captain should release the time.",
    message: buildCaptainMessageByType(
      PREVIEW_BOOKING,
      CAPTAIN_MESSAGE_TYPES.cancellation,
    ),
    title: "Cancellation",
  },
];

function MessagePreviewCard({ preview }) {
  return (
    <article className="border border-stone-300 bg-[#fbf8f3] p-5">
      <div className="flex flex-col justify-between gap-4 border-b border-stone-200 pb-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.18em] text-stone-500">
            Captain message
          </p>
          <h2 className="mt-2 text-2xl font-light tracking-[-0.03em]">
            {preview.title}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">
            {preview.description}
          </p>
        </div>
        <CopyCaptainMessageButton message={preview.message} />
      </div>

      <pre className="mt-5 whitespace-pre-wrap break-words border border-stone-200 bg-[#f3eee7] p-4 text-sm leading-6 text-stone-800">
        {preview.message}
      </pre>
    </article>
  );
}

export function MessagePreviewContent() {
  return (
    <>
      <section className="mt-6 border border-stone-300 bg-[#fbf8f3] p-6 text-sm leading-6 text-stone-700">
        These are the captain WhatsApp templates used in production. Preview,
        copy message, and WhatsApp sending all use the same template source.
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-2">
        {MESSAGE_PREVIEWS.map((preview) => (
          <MessagePreviewCard key={preview.title} preview={preview} />
        ))}
      </section>
    </>
  );
}

export default function AdminMessagePage() {
  redirect("/admin/development?tab=message-preview");
}
