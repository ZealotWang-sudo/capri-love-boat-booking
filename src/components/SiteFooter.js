import Link from "next/link";

export default function SiteFooter({ labels, locale }) {
  return (
    <footer className="border-t border-stone-300 bg-[#f3eee7] px-5 py-10 text-stone-950 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 text-sm leading-7 text-stone-600 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="brand-logo text-xs text-stone-500">{labels.brand}</p>
          <p className="mt-3">All rights reserved @ {new Date().getFullYear()}</p>
        </div>
        <nav className="flex flex-wrap gap-4 text-xs uppercase tracking-[0.18em] text-stone-500">
          <Link href={`/${locale}/contact`} className="hover:text-stone-950">
            {labels.contact}
          </Link>
          <Link href={`/${locale}/policy`} className="hover:text-stone-950">
            {labels.policy}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
