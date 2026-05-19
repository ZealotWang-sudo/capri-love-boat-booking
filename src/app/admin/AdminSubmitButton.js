"use client";

import { useFormStatus } from "react-dom";

export default function AdminSubmitButton({
  children,
  className,
  disabled = false,
  pendingLabel = "Saving...",
}) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return (
    <button
      type="submit"
      disabled={isDisabled}
      className={className}
      aria-busy={pending}
    >
      {pending ? (
        <span className="inline-flex items-center justify-center gap-2">
          <span
            aria-hidden="true"
            className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"
          />
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
