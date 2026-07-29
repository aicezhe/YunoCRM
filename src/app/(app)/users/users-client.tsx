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
    <div className="flex flex-col items-start gap-1">
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
      {error && <p className="max-w-[14rem] text-xs text-red-600">{error}</p>}
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

export function UsersClient({ initialUsers }: { initialUsers: UserRow[] }) {
  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <InviteForm />
      </div>

      <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_20px_45px_-30px_rgba(91,79,233,0.35)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-medium tracking-wide text-gray-400 uppercase">
                <th className="px-5 py-4">Name</th>
                <th className="px-5 py-4">Email</th>
                <th className="px-5 py-4">Role</th>
                <th className="px-5 py-4">Joined</th>
              </tr>
            </thead>
            <tbody>
              {initialUsers.map((user, i) => (
                <tr key={user.id} className={i !== initialUsers.length - 1 ? "border-b border-gray-50" : ""}>
                  <td className="px-5 py-4 font-medium text-gray-900">{user.name}</td>
                  <td className="px-5 py-4 text-gray-500">{user.email}</td>
                  <td className="px-5 py-4">
                    <RoleToggle user={user} />
                  </td>
                  <td className="px-5 py-4 text-gray-500">{fmtDate(user.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
