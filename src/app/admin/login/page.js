"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function getNextPath() {
  if (typeof window === "undefined") {
    return "/admin";
  }

  const nextPath = new URLSearchParams(window.location.search).get("next");

  return nextPath?.startsWith("/admin") ? nextPath : "/admin";
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email")?.toString().trim().toLowerCase();
    const password = formData.get("password")?.toString();
    const supabase = createSupabaseBrowserClient();

    setError("");
    setIsSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError("Could not sign in. Check your email and password.");
      setIsSubmitting(false);
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const nextPath = getNextPath();

    console.info("[admin login] Client session exists after sign in", {
      hasSession: Boolean(session),
      userEmail: session?.user?.email ?? null,
    });

    window.location.assign(nextPath);
  }

  return (
    <main className="min-h-screen bg-[#f3eee7] px-5 py-16 text-stone-950 sm:px-8">
      <section className="mx-auto max-w-md border-t border-stone-300 pt-10">
        <p className="brand-logo text-xs text-stone-500">
          Capri Love Boat
        </p>
        <h1 className="mt-8 text-4xl font-light tracking-[-0.03em]">
          Admin login
        </h1>
        <form onSubmit={handleSubmit} className="mt-10 space-y-5">
          <div>
            <label className="block text-xs uppercase tracking-[0.18em] text-stone-500">
              Email
            </label>
            <input
              name="email"
              type="email"
              required
              className="mt-3 w-full border border-stone-300 bg-transparent px-4 py-4 outline-none transition focus:border-stone-950"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-[0.18em] text-stone-500">
              Password
            </label>
            <input
              name="password"
              type="password"
              required
              className="mt-3 w-full border border-stone-300 bg-transparent px-4 py-4 outline-none transition focus:border-stone-950"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full border border-stone-950 bg-stone-950 px-6 py-4 text-xs font-medium uppercase tracking-[0.22em] text-[#f3eee7] transition hover:bg-transparent hover:text-stone-950 disabled:cursor-wait disabled:opacity-60"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
          {error ? <p className="text-sm text-red-900">{error}</p> : null}
        </form>
      </section>
    </main>
  );
}
