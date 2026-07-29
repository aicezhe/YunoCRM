"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, User as UserIcon, UserPlus } from "lucide-react";
import { inviteUser, updateUserRole } from "./actions";
import type { UserRow } from "./queries";

function fmtDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function RoleToggle({ user }: { user: UserRow }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const nextRole = user.role === "admin" ? "member" : "admin";
    setError(null);
    startTransition(async () => {
      const res = await updateUserRole(user.id, nextRole);
      if (!res.ok) return setError(res.error);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={toggle}
        disabled={isPending}
        className={
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition disabled:opacity-60 " +
          (user.role === "admin"
            ? "bg-[#5B4FE9]/10 text-[#5B4FE9] hover:bg-[#5B4FE9]/15"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200")
        }
        title="Click to toggle role"
      >
        {user.role === "admin" ? (
          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
        ) : (
          <UserIcon className="h-3.5 w-3.5" strokeWidth={2} />
        )}
        {user.role}
      </button>
      {error && <p className="max-w-[14rem] text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}

function InviteForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await inviteUser(email, role);
      if (!res.ok) return setError(res.error);
      setEmail("");
      setRole("member");
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#5B4FE9] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4B3FE0]"
      >
        <UserPlus className="h-4 w-4" strokeWidth={2} />
        Invite user
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@company.com"
          autoFocus
          className="min-h-10 flex-1 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#5B4FE9]/50 focus:ring-2 focus:ring-[#5B4FE9]/10"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "admin" | "member")}
          className="min-h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#5B4FE9]/50"
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <div className="flex gap-2">
          <button
            onClick={submit}
            disabled={isPending || !email.trim()}
            className="min-h-10 shrink-0 rounded-xl bg-[#5B4FE9] px-4 text-sm font-semibold text-white transition hover:bg-[#4B3FE0] disabled:opacity-60"
          >
            Send invite
          </button>
          <button
            onClick={() => setOpen(false)}
            disabled={isPending}
            className="min-h-10 shrink-0 rounded-xl px-4 text-sm font-medium text-gray-500 hover:bg-gray-100"
          >
            Cancel
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

/** Initials for the avatar chip — first letter of the first two words. */
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function UserCard({ user }: { user: UserRow }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white px-5 py-4 shadow-[0_14px_32px_-28px_rgba(91,79,233,0.5)] transition duration-300 hover:-translate-y-0.5 hover:border-[#5B4FE9]/25 hover:shadow-[0_18px_38px_-26px_rgba(91,79,233,0.4)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#5B4FE9]/10 text-sm font-semibold text-[#5B4FE9]">
        {initials(user.name)}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-gray-900">{user.name}</p>
        <p className="truncate text-sm text-gray-500">{user.email}</p>
        <p className="mt-0.5 text-xs text-gray-400 sm:hidden">Joined {fmtDate(user.createdAt)}</p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <RoleToggle user={user} />
        <p className="hidden text-xs text-gray-400 sm:block">Joined {fmtDate(user.createdAt)}</p>
      </div>
    </div>
  );
}

export function UsersClient({ initialUsers }: { initialUsers: UserRow[] }) {
  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <InviteForm />
      </div>

      <div className="space-y-3">
        {initialUsers.map((user) => (
          <UserCard key={user.id} user={user} />
        ))}
      </div>
    </div>
  );
}
