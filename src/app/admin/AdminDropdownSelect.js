"use client";

import { useId, useState } from "react";

function getSelectedLabel(options, value, placeholder) {
  return options.find((option) => option.value === value)?.label ?? placeholder;
}

export default function AdminDropdownSelect({
  label,
  name,
  options,
  placeholder = "Choose an option",
}) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState("");
  const selectedLabel = getSelectedLabel(options, selectedValue, placeholder);

  function handleSelect(option) {
    setSelectedValue(option.value);
    setOpen(false);
  }

  return (
    <div>
      <label className="block text-xs uppercase tracking-[0.18em] text-stone-500">
        {label}
      </label>
      <input type="hidden" name={name} value={selectedValue} />
      <div className="relative mt-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listboxId}
          onClick={() => setOpen((currentOpen) => !currentOpen)}
          className="flex w-full items-center justify-between border border-stone-300 bg-transparent px-4 py-3 text-left text-sm text-stone-950 outline-none transition hover:border-stone-950 focus:border-stone-950"
        >
          <span>{selectedLabel}</span>
          <span className="text-xs uppercase tracking-[0.18em] text-stone-500">
            {open ? "Close" : "Select"}
          </span>
        </button>
        {open ? (
          <div
            id={listboxId}
            role="listbox"
            className="absolute left-0 top-full z-[70] mt-2 max-h-64 w-full overflow-y-auto border border-stone-950 bg-[#fbf8f3] p-2 shadow-xl"
          >
            {options.map((option) => {
              const selected = option.value === selectedValue;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => handleSelect(option)}
                  className={[
                    "w-full px-3 py-2 text-left text-sm transition hover:bg-stone-950 hover:text-[#f3eee7]",
                    selected ? "bg-stone-950 text-[#f3eee7]" : "text-stone-700",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
