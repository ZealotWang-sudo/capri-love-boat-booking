"use client";

import { useEffect, useId, useRef, useState } from "react";

export default function FormDropdown({ label, name, onChange, options, value }) {
  const listboxId = useId();
  const dropdownRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(
    (option) => String(option.value) === String(value),
  );

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!dropdownRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function selectOption(option) {
    onChange(option.value);
    setIsOpen(false);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-xs uppercase tracking-[0.18em] text-stone-500">
        {label}
      </label>
      {name ? <input type="hidden" name={name} value={value ?? ""} /> : null}
      <button
        type="button"
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        className="mt-3 flex w-full items-center justify-between gap-3 border border-stone-300 bg-[#fbf8f3] px-4 py-4 text-left text-sm text-stone-950 transition hover:border-stone-950 focus:border-stone-950 focus:outline-none"
      >
        <span className="truncate">{selectedOption?.label ?? value}</span>
        <span aria-hidden="true" className="text-xs text-stone-500">
          {isOpen ? "▲" : "▼"}
        </span>
      </button>

      {isOpen ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label={label}
          className="absolute left-0 right-0 z-30 mt-2 border border-stone-950 bg-[#fbf8f3] p-2 shadow-xl"
        >
          {options.map((option) => {
            const isSelected = String(option.value) === String(value);

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => selectOption(option)}
                className={`block w-full px-3 py-3 text-left text-sm leading-5 transition ${
                  isSelected
                    ? "bg-stone-950 text-[#f3eee7]"
                    : "text-stone-700 hover:bg-stone-100"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
