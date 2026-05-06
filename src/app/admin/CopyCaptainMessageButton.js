"use client";

import { useState } from "react";

export default function CopyCaptainMessageButton({ message }) {
  const [status, setStatus] = useState("idle");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="border border-stone-950 px-3 py-2 text-[0.65rem] font-medium uppercase tracking-[0.18em] text-stone-950 transition hover:bg-stone-950 hover:text-[#f3eee7]"
    >
      {status === "copied"
        ? "Copied"
        : status === "failed"
          ? "Copy failed"
          : "Copy message"}
    </button>
  );
}
