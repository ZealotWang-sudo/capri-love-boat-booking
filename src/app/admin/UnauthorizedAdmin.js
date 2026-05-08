export default function UnauthorizedAdmin() {
  return (
    <main className="min-h-screen bg-[#f3eee7] px-5 py-16 text-stone-950 sm:px-8">
      <section className="mx-auto max-w-3xl border-t border-stone-300 pt-10">
        <p className="brand-logo text-xs text-stone-500">
          Capri Love Boat Admin
        </p>
        <h1 className="mt-8 text-4xl font-light tracking-[-0.03em]">
          Unauthorized
        </h1>
        <p className="mt-6 text-stone-600">
          This account does not have access to the admin area.
        </p>
        <form action="/admin/logout" method="post">
          <button
            type="submit"
            className="mt-10 border border-stone-950 px-6 py-4 text-xs font-medium uppercase tracking-[0.22em] transition hover:bg-stone-950 hover:text-[#f3eee7]"
          >
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}
