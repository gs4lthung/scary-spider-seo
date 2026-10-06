"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { updateUserRole, deleteUser, setUserLoginEmail, sendPasswordResetLink } from "@/app/admin/users-actions";
import { useToast } from "@/components/Toaster";

type Role = "admin" | "editor";

export function UserRow({
  user,
  isSelf,
}: {
  user: {
    id: number;
    username: string;
    displayName: string | null;
    jobTitle: string | null;
    role: Role;
    createdAt: Date;
    loginEmail: string | null;
  };
  isSelf: boolean;
}) {
  const { toast } = useToast();
  const [role, setRole] = useState<Role>(user.role);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState(user.loginEmail ?? "");
  const [savedLoginEmail, setSavedLoginEmail] = useState(user.loginEmail ?? "");
  const [emailPending, startEmailTransition] = useTransition();

  function onSaveLoginEmail() {
    setError(null);
    startEmailTransition(async () => {
      const res = await setUserLoginEmail(user.id, loginEmail);
      if ("error" in res) {
        setError(res.error);
        toast(res.error, "error");
        return;
      }
      setLoginEmail(loginEmail.trim().toLowerCase());
      setSavedLoginEmail(loginEmail.trim().toLowerCase());
      toast("Login email saved");
    });
  }

  function onSendResetLink() {
    if (!confirm(`Email a password reset link to ${savedLoginEmail}?`)) return;
    setError(null);
    startEmailTransition(async () => {
      try {
        const res = await sendPasswordResetLink(user.id);
        if ("error" in res) {
          setError(res.error);
          toast(res.error, "error");
          return;
        }
        toast(`Reset link sent to ${savedLoginEmail}`);
      } catch {
        toast("Couldn't send the reset link.", "error");
      }
    });
  }

  function onRoleChange(next: Role) {
    setError(null);
    const prev = role;
    setRole(next);
    startTransition(async () => {
      try {
        await updateUserRole(user.id, next);
        toast("Role updated");
      } catch (e) {
        setRole(prev);
        setError(e instanceof Error ? e.message : "Couldn't update role.");
        toast(e instanceof Error ? e.message : "Couldn't update role.", "error");
      }
    });
  }

  function onDelete() {
    if (!confirm(`Delete user "${user.username}"? This can't be undone.`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteUser(user.id);
        toast("User deleted");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't delete user.");
        toast(e instanceof Error ? e.message : "Couldn't delete user.", "error");
      }
    });
  }

  return (
    <tr>
      <td className="px-4 py-3">
        <p className="font-medium">{user.displayName || user.username}</p>
        <p className="text-xs text-muted-foreground">
          @{user.username}
          {user.jobTitle ? ` · ${user.jobTitle}` : ""}
        </p>
        {isSelf ? <p className="text-xs text-muted-foreground">This is you</p> : null}
        {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      </td>
      <td className="px-4 py-3">
        <select
          value={role}
          disabled={isSelf || pending}
          onChange={(e) => onRoleChange(e.target.value as Role)}
          className="rounded border border-border bg-background px-2 py-1 text-sm disabled:opacity-50"
        >
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
        </select>
      </td>
      <td className="px-4 py-3">
        {isSelf ? (
          // Your own login email needs your current password, so it is only
          // editable on the profile page (see users-actions.ts updateProfile).
          <div>
            <p className="text-sm">{savedLoginEmail || <span className="text-muted-foreground">Not set</span>}</p>
            <Link href="/admin/profile" className="text-xs text-primary hover:underline">
              Change on My profile
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="name@example.com"
                aria-label={`Login email for ${user.username}`}
                className="w-52 rounded border border-border bg-background px-2 py-1 text-sm"
              />
              {loginEmail.trim().toLowerCase() !== savedLoginEmail ? (
                <button
                  type="button"
                  onClick={onSaveLoginEmail}
                  disabled={emailPending}
                  className="rounded border border-border px-2 py-1 text-xs hover:bg-secondary disabled:opacity-50"
                >
                  Save
                </button>
              ) : null}
            </div>
            {savedLoginEmail ? (
              <button
                type="button"
                onClick={onSendResetLink}
                disabled={emailPending}
                className="mt-1 text-xs text-primary hover:underline disabled:opacity-50"
              >
                {emailPending ? "Working..." : "Send reset link"}
              </button>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">Private, used for password resets</p>
            )}
          </>
        )}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {user.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
      </td>
      <td className="px-4 py-3 text-right">
        {isSelf ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <button type="button" onClick={onDelete} disabled={pending} className="text-red-600 hover:underline disabled:opacity-50">
            Delete
          </button>
        )}
      </td>
    </tr>
  );
}
