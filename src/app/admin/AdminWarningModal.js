"use client";

export default function AdminWarningModal({
  cancelLabel = "Cancel",
  children,
  extraContent,
  message,
  onCancel,
  open,
  title = "Please confirm",
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-950/35 px-4 py-6">
      <div className="w-full max-w-md border border-stone-950 bg-[#f3eee7] p-6 text-stone-950 shadow-xl">
        <p className="text-xs uppercase tracking-[0.22em] text-red-900">
          Warning
        </p>
        <h2 className="mt-4 text-2xl font-light tracking-[-0.03em]">{title}</h2>
        <p className="mt-4 text-sm leading-6 text-stone-700">{message}</p>
        {extraContent ? <div className="mt-5">{extraContent}</div> : null}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onCancel}
            className="border border-stone-300 px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
          >
            {cancelLabel}
          </button>
          {children}
        </div>
      </div>
    </div>
  );
}
