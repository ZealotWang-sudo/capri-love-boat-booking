export default function AdminCalendarLoading() {
  return (
    <main className="min-h-screen bg-[#f3eee7] px-5 py-10 text-stone-950 sm:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="border border-stone-300 bg-[#fbf8f3] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="h-3 w-28 animate-pulse bg-stone-300" />
              <div className="mt-3 h-8 w-52 animate-pulse bg-stone-300" />
            </div>
            <div className="inline-flex items-center gap-2 border border-stone-300 px-4 py-3 text-xs uppercase tracking-[0.18em] text-stone-600">
              <span
                aria-hidden="true"
                className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"
              />
              Loading calendar...
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
