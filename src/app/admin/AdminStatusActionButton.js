"use client";

import { useFormStatus } from "react-dom";

const VARIANT_CLASSES = {
  default:
    "border-stone-300 text-stone-700 hover:border-stone-950 hover:bg-stone-950 hover:text-[#f3eee7]",
  primary:
    "border-stone-950 bg-stone-950 text-[#f3eee7] hover:bg-transparent hover:text-stone-950",
  danger:
    "border-red-900/40 text-red-900 hover:border-red-900 hover:bg-red-900 hover:text-[#f3eee7]",
};

export default function AdminStatusActionButton({
  children,
  onClick,
  type = "submit",
  variant = "default",
}) {
  const { pending } = useFormStatus();
  const variantClasses = VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.default;

  return (
    <button
      type={type}
      disabled={pending}
      onClick={onClick}
      className={[
        "w-full border px-3 py-2 text-center text-[0.65rem] font-medium uppercase tracking-[0.14em] transition disabled:cursor-wait disabled:opacity-60",
        variantClasses,
      ].join(" ")}
    >
      {pending ? "Updating..." : children}
    </button>
  );
}
