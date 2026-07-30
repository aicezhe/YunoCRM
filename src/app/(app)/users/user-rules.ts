/**
 * Authorization and validation rules for user management, kept free of the
 * database, the session and next-intl so they can be tested directly — same
 * split as scripts/classification-rules.ts and scripts/resolution-rules.ts.
 *
 * The server actions in ./actions.ts stay thin: fetch the facts, ask a
 * function here what to do, then apply it. What the rules must NOT do is
 * decide anything from data the caller supplied about themselves — every
 * caller-derived input here comes from the server-side session lookup.
 */

export type Role = "admin" | "member";

/**
 * Managing users is admin-only. `null` covers the signed-out case, which the
 * middleware should already have redirected — but a server action is a plain
 * POST endpoint, so it re-checks rather than trusting that it was reached
 * through the UI.
 */
export function canManageUsers(callerRole: Role | null | undefined): boolean {
  return callerRole === "admin";
}

export type RoleChangeInput = {
  callerRole: Role | null | undefined;
  /** `null` when no user row matched the id. */
  targetRole: Role | null;
  newRole: Role;
  /** How many admins exist right now, target included. */
  adminCount: number;
};

export type RoleChangeDecision =
  | { kind: "denied"; reason: "not-allowed" | "user-not-found" | "last-admin" }
  /** Already in the requested role — succeed without touching the database. */
  | { kind: "noop" }
  | { kind: "apply" };

/**
 * Order matters: authorization is answered before existence, so a member
 * probing ids can't tell a real user from a made-up one by the error text.
 */
export function decideRoleChange({
  callerRole,
  targetRole,
  newRole,
  adminCount,
}: RoleChangeInput): RoleChangeDecision {
  if (!canManageUsers(callerRole)) return { kind: "denied", reason: "not-allowed" };
  if (targetRole === null) return { kind: "denied", reason: "user-not-found" };
  if (targetRole === newRole) return { kind: "noop" };

  // Demoting the only admin would leave nobody able to promote anyone back —
  // the workspace would be permanently stuck with no user management.
  if (targetRole === "admin" && newRole === "member" && adminCount <= 1) {
    return { kind: "denied", reason: "last-admin" };
  }

  return { kind: "apply" };
}

export type InviteEmailResult = { ok: true; email: string } | { ok: false; reason: "invalid" };

/**
 * Normalizes before validating so the caller stores exactly what was checked:
 * addresses are compared and stored lowercased, which is what makes the
 * duplicate check meaningful (`contacts.email` and `users.email` are unique).
 */
export function normalizeInviteEmail(raw: string): InviteEmailResult {
  const email = raw.trim().toLowerCase();
  // Deliberately not an RFC-complete pattern: this rejects obvious typos, and
  // deliverability is proven by the invite mail arriving, not by a regex.
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, reason: "invalid" };
  return { ok: true, email };
}
