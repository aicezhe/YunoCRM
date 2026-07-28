export default function SourceLoading() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse px-5 pt-4 sm:px-6 sm:pt-6">
      <div className="h-5 w-24 rounded bg-gray-200" />
      <div className="mt-4 h-9 w-40 rounded bg-gray-200" />
      <div className="mt-2 h-4 w-80 max-w-full rounded bg-gray-100" />

      <div className="mt-8 rounded-3xl bg-white p-8 shadow-sm">
        <div className="mx-auto h-[220px] w-[220px] rounded-full border-[28px] border-gray-100" />
        <div className="mx-auto mt-6 h-4 w-64 max-w-full rounded bg-gray-100" />
      </div>
    </div>
  );
}
