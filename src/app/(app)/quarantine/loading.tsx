export default function QuarantineLoading() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse px-5 pt-4 sm:px-6 sm:pt-6">
      <div className="h-5 w-24 rounded bg-gray-200" />
      <div className="mt-4 h-9 w-48 rounded bg-gray-200" />
      <div className="mt-2 h-4 w-80 max-w-full rounded bg-gray-100" />

      <div className="mt-8 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 rounded-3xl bg-white shadow-sm" />
        ))}
      </div>
    </div>
  );
}
