export default function Loading() {
  return (
    <div className="p-5">
      <div className="h-8 w-64 animate-pulse rounded-md bg-slate-200" />
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-40 animate-pulse rounded-lg bg-slate-200" />
        ))}
      </div>
    </div>
  );
}
