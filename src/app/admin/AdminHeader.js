import AdminNav from "./AdminNav";

export default function AdminHeader({ active, title, userEmail }) {
  return (
    <div className="flex flex-col justify-between gap-6 border-b border-stone-300 pb-8 lg:flex-row lg:items-end">
      <div>
        <p className="brand-logo text-xs text-stone-500">
          Capri Love Boat Admin
        </p>
        <h1 className="mt-5 text-4xl font-light tracking-[-0.03em]">
          {title}
        </h1>
        <p className="mt-3 text-sm text-stone-600">Signed in as {userEmail}</p>
      </div>
      <div className="flex flex-col items-start gap-3 lg:items-end">
        <AdminNav active={active} />
        <form action="/admin/logout" method="post">
          <button
            type="submit"
            className="border border-stone-950 px-6 py-4 text-xs font-medium uppercase tracking-[0.22em] transition hover:bg-stone-950 hover:text-[#f3eee7]"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
