"use client";

import { useState, useTransition } from "react";
import { updateUserRole, deleteUser } from "@/app/admin/users-actions";
import { useToast } from "@/components/Toaster";

type Role = "admin" | "editor";

export function UserRow({
  user,
  isSelf,
}: {
  user: { id: number; username: string; displayName: string | null; jobTitle: string | null; role: Role; createdAt: Date };
  isSelf: boolean;
}) {
  const { toast } = useToast();
  const [role, setRole] = useState<Role>(user.role);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
