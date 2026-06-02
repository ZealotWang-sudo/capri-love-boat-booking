"use client";

import { useState } from "react";

function getInitial(email) {
  return email?.trim()?.[0]?.toUpperCase() || "A";
}

export default function AdminProfileMenu({ userEmail }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-label="Open admin profile menu"
        className="grid h-10 w-10 place-items-center rounded-full border border-stone-950 bg-stone-950 text-sm font-medium text-[#f3eee7] transition hover:bg-transparent hover:text-stone-950"
      >
        {getInitial(userEmail)}
      </button>

      {isOpen ? (
        <div className="absolute right-0 z-50 mt-3 w-72 border border-stone-300 bg-[#fbf8f3] p-4 text-stone-950 shadow-xl">
          <p className="text-[0.65rem] uppercase tracking-[0.16em] text-stone-500">
            Signed in as
          </p>
          <p className="mt-2 break-all text-sm text-stone-700">{userEmail}</p>
          <form action="/admin/logout" method="post" className="mt-4">
            <button
              type="submit"
              className="w-full border border-stone-950 px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] transition hover:bg-stone-950 hover:text-[#f3eee7]"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
