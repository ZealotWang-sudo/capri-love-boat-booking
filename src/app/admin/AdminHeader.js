export default function AdminHeader({ active, title, userEmail }) {
  return (
    <div className="border-b border-stone-300 pb-8">
      <div>
        <h1 className="text-4xl font-light tracking-[-0.03em]">
          {title}
        </h1>
      </div>
    </div>
  );
}
