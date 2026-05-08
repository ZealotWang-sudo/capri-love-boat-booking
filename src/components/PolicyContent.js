export const POLICY_ITEM_KEYS = [
  "reservationFee",
  "paymentWindow",
  "balance",
  "weather",
  "weatherCancellation",
  "lateArrival",
  "noShow",
  "confirmedCancellation",
  "blueGrotto",
];

export default function PolicyContent({ labels, variant = "page" }) {
  const compact = variant === "modal";

  return (
    <div
      className={
        compact ? "space-y-5" : "grid gap-8 lg:grid-cols-[0.8fr_1.2fr]"
      }
    >
      <aside
        className={
          compact
            ? "border-l border-stone-950 pl-4 text-sm leading-7 text-stone-600"
            : "border-l border-stone-950 pl-5 text-sm leading-7 text-stone-600"
        }
      >
        <h2 className="text-base font-medium text-stone-950">
          {labels.introTitle}
        </h2>
        <p className="mt-3">{labels.introText}</p>
      </aside>

      <div className={compact ? "space-y-3" : "space-y-4"}>
        {POLICY_ITEM_KEYS.map((itemKey, index) => (
          <article
            key={itemKey}
            className={
              compact
                ? "border border-stone-300 bg-[#fbf8f3] p-4"
                : "border border-stone-300 bg-[#fbf8f3] p-5 sm:p-6"
            }
          >
            <div className="flex gap-4">
              <span className="shrink-0 text-xs uppercase tracking-[0.18em] text-stone-500">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h2
                  className={
                    compact
                      ? "text-base font-medium tracking-[-0.01em]"
                      : "text-xl font-light tracking-[-0.02em]"
                  }
                >
                  {labels[`${itemKey}Title`]}
                </h2>
                <p className="mt-3 text-sm leading-7 text-stone-600">
                  {labels[`${itemKey}Text`]}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
