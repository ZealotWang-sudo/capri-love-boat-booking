export default function AdminCalendarLoading() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f3eee7] px-3 py-6 text-stone-950 sm:px-8 sm:py-10">
      <section className="mx-auto max-w-7xl">
        <div className="border border-stone-300 bg-[#fbf8f3] p-4 sm:p-6">
          <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 w-full max-w-md">
              <div className="h-3 w-28 max-w-full animate-pulse bg-stone-300" />
              <div className="mt-3 h-8 w-52 max-w-full animate-pulse bg-stone-300" />
            </div>
            <div className="inline-flex w-full items-center justify-center gap-2 border border-stone-300 px-3 py-3 text-center text-[0.65rem] font-medium uppercase tracking-[0.14em] text-stone-600 sm:w-auto sm:px-4 sm:text-xs sm:tracking-[0.18em]">
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
