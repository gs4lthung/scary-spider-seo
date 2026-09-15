"use client";

import { useActionState } from "react";
import { createCategory } from "@/app/admin/categories-actions";

export function CreateCategoryForm() {
  const [error, formAction, pending] = useActionState(createCategory, null);

  return (
    <form action={formAction} className="flex items-end gap-3 rounded-lg border border-border bg-card p-4">
      <div>
        <label htmlFor="category-name" className="block text-xs font-medium text-muted-foreground">
          New category
        </label>
        <input
          id="category-name"
          name="name"
          required
          placeholder="e.g. Technical SEO"
          className="mt-1 rounded border border-border bg-background px-2.5 py-1.5 text-sm"
        />
      </div>
      <button type="submit" disabled={pending} className="rounded bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        {pending ? "Adding..." : "Add category"}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
