import AdminHeader from "./AdminHeader";
import { getAdminUser, isAllowedAdmin } from "./auth";
import UnauthorizedAdmin from "./UnauthorizedAdmin";

export default async function AdminEmptyPage({ active, nextPath, title }) {
  const user = await getAdminUser(nextPath);

  if (!isAllowedAdmin(user)) {
    return <UnauthorizedAdmin />;
  }

  return (
    <main className="min-h-screen bg-[#f3eee7] px-5 py-10 text-stone-950 sm:px-8">
      <section className="mx-auto max-w-7xl">
        <AdminHeader active={active} title={title} userEmail={user.email} />

        <section className="mt-8 border border-dashed border-stone-300 bg-[#fbf8f3] p-8 text-stone-600">
          This page is empty for now.
        </section>
      </section>
    </main>
  );
}
