"use client";

import { useState } from "react";

export default function CopyTextButton({
  text,
  label = "Copy",
  copiedLabel = "Copied",
}) {
  const [isCopied, setIsCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1400);
    } catch {
      setIsCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ml-2 border border-stone-300 px-2 py-1 text-[0.6rem] font-medium uppercase tracking-[0.16em] text-stone-600 transition hover:border-stone-950 hover:bg-stone-950 hover:text-[#f3eee7]"
    >
      {isCopied ? copiedLabel : label}
    </button>
  );
}
