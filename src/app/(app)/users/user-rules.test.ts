import { describe, expect, it } from "vitest";
import { canManageUsers, decideRoleChange, normalizeInviteEmail } from "./user-rules";

describe("canManageUsers", () => {
  it("allows admins", () => {
    expect(canManageUsers("admin")).toBe(true);
  });

  // The brief's line: "Member: works on prospects but cannot manage
  // users/roles." The /users page redirects members away, but a server
  // action is a plain POST endpoint — this is the check that actually stops
  // a member from promoting themselves by calling it directly.
  it("refuses members", () => {
    expect(canManageUsers("member")).toBe(false);
  });

  it("refuses a caller with no session", () => {
    expect(canManageUsers(null)).toBe(false);
    expect(canManageUsers(undefined)).toBe(false);
  });
});

describe("decideRoleChange", () => {
  const base = { callerRole: "admin" as const, targetRole: "member" as const, newRole: "admin" as const, adminCount: 2 };

  it("applies a promotion requested by an admin", () => {
    expect(decideRoleChange(base)).toEqual({ kind: "apply" });
  });

  it("applies a demotion while other admins remain", () => {
    expect(decideRoleChange({ ...base, targetRole: "admin", newRole: "member", adminCount: 3 })).toEqual({
      kind: "apply",
    });
  });

  it("denies a member trying to promote themselves", () => {
    expect(decideRoleChange({ ...base, callerRole: "member" })).toEqual({
      kind: "denied",
      reason: "not-allowed",
    });
  });

  it("denies a signed-out caller", () => {
    expect(decideRoleChange({ ...base, callerRole: null })).toEqual({
      kind: "denied",
      reason: "not-allowed",
    });
  });

  // Authorization is answered before existence on purpose: otherwise the
  // error text would tell an unauthorized caller which user ids are real.
  it("does not leak whether a user exists to an unauthorized caller", () => {
    expect(decideRoleChange({ ...base, callerRole: "member", targetRole: null })).toEqual({
      kind: "denied",
      reason: "not-allowed",
    });
  });

  it("reports a missing user to an admin", () => {
    expect(decideRoleChange({ ...base, targetRole: null })).toEqual({
      kind: "denied",
      reason: "user-not-found",
    });
  });

  it("treats a no-op change as success without touching the database", () => {
    expect(decideRoleChange({ ...base, targetRole: "admin", newRole: "admin" })).toEqual({ kind: "noop" });
  });

  it("refuses to demote the last remaining admin", () => {
    expect(decideRoleChange({ ...base, targetRole: "admin", newRole: "member", adminCount: 1 })).toEqual({
      kind: "denied",
      reason: "last-admin",
    });
  });

  it("still allows demoting a member when only one admin exists", () => {
    // The last-admin guard must key off the TARGET being an admin, not off
    // the admin count alone — otherwise a one-admin workspace could never
    // change any role at all.
    expect(decideRoleChange({ ...base, targetRole: "member", newRole: "member", adminCount: 1 })).toEqual({
      kind: "noop",
    });
    expect(decideRoleChange({ ...base, targetRole: "member", newRole: "admin", adminCount: 1 })).toEqual({
      kind: "apply",
    });
  });
});

describe("normalizeInviteEmail", () => {
  it("trims and lowercases, so the duplicate check compares like for like", () => {
    expect(normalizeInviteEmail("  Marco@YunoAI.io ")).toEqual({ ok: true, email: "marco@yunoai.io" });
  });

  it.each(["", "   ", "marco", "marco@", "@yunoai.io", "marco@yunoai", "marco @yunoai.io"])(
    "rejects %j",
    (input) => {
      expect(normalizeInviteEmail(input)).toEqual({ ok: false, reason: "invalid" });
    }
  );
});
