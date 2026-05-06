"use client";

export default function StyledCheckbox({
  name,
  value,
  label,
  type = "checkbox",
  required = false,
  checked,
  disabled = false,
  onChange,
}) {
  return (
    <label
      className={[
        "group block",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      ].join(" ")}
    >
      <input
        type={type}
        name={name}
        value={value}
        required={required}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="peer sr-only"
      />
      <span className="flex min-h-16 items-center gap-4 border border-stone-300 bg-transparent px-4 py-3 text-sm leading-6 transition peer-checked:border-stone-950 peer-checked:bg-stone-950 peer-checked:text-[#f3eee7] peer-checked:[&_.check-box]:bg-[#f3eee7] peer-checked:[&_.check-mark]:opacity-100 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-stone-950 peer-disabled:bg-stone-100 peer-disabled:text-stone-400 peer-disabled:shadow-none group-hover:border-stone-950 group-has-[:disabled]:hover:border-stone-300">
        <span className="check-box flex h-4 w-4 shrink-0 items-center justify-center border border-current transition">
          <svg
            aria-hidden="true"
            viewBox="0 0 12 10"
            className="check-mark h-2.5 w-3 text-stone-950 opacity-0 transition"
          >
            <path
              d="M1 5L4.2 8L11 1"
              fill="none"
              stroke="currentColor"
              strokeLinecap="square"
              strokeLinejoin="miter"
              strokeWidth="2"
            />
          </svg>
        </span>
        <span className="min-w-0 flex-1 text-sm leading-6">{label}</span>
      </span>
    </label>
  );
}
