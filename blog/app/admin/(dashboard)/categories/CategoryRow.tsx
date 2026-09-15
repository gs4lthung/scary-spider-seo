"use client";

import { useState, useTransition } from "react";
import { renameCategory, deleteCategory } from "@/app/admin/categories-actions";

export function CategoryRow({ category }: { category: { id: number; name: string; slug: string; postCount: number } }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function saveRename() {
    setError(null);
    startTransition(async () => {
      try {
        await renameCategory(category.id, name);
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't rename category.");
      }
    });
  }

  function onDelete() {
    const warning =
      category.postCount > 0
        ? `Delete "${category.name}"? ${category.postCount} post(s) will keep the label until edited.`
        : `Delete "${category.name}"?`;
    if (!confirm(warning)) return;
    startTransition(() => deleteCategory(category.id));
  }

  return (
    <tr>
      <td className="px-4 py-3">
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveRename()}
            className="rounded border border-border bg-background px-2 py-1 text-sm"
          />
        ) : (
          <p className="font-medium">{category.name}</p>
        )}
        {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      </td>
      <td className="px-4 py-3 text-muted-foreground">{category.postCount}</td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-3">
          {editing ? (
            <>
              <button type="button" onClick={saveRename} disabled={pending} className="text-primary hover:underline">
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setName(category.name);
                }}
                className="text-muted-foreground hover:underline"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setEditing(true)} className="text-primary hover:underline">
                Rename
              </button>
              <button type="button" onClick={onDelete} disabled={pending} className="text-red-600 hover:underline disabled:opacity-50">
                Delete
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
