export default function UsersLoading() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse px-5 pt-4 sm:px-6 sm:pt-6">
      <div className="h-5 w-24 rounded bg-gray-200" />
      <div className="mt-4 h-9 w-32 rounded bg-gray-200" />
      <div className="mt-2 h-4 w-64 max-w-full rounded bg-gray-100" />

      <div className="mt-8 h-64 rounded-3xl bg-white shadow-sm" />
    </div>
  );
}
