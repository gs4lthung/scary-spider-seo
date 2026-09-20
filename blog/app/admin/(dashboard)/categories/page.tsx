import { getCategoriesWithCounts } from "@/lib/db/queries";
import { CategoryRow } from "./CategoryRow";
import { CreateCategoryForm } from "./CreateCategoryForm";

export default async function CategoriesPage() {
  const cats = await getCategoriesWithCounts();

  return (
    <div>
      <h1 className="text-2xl font-bold">Categories</h1>
      <p className="mt-1 text-sm text-muted-foreground">Manage the categories posts can be labeled with.</p>

      <div className="mt-6">
        <CreateCategoryForm />
      </div>

      {cats.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border py-16 text-center">
          <p className="font-semibold">No categories yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">Add one above to start labeling posts.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-card text-xs text-muted-foreground uppercase">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Posts</th>
                <th className="px-4 py-3 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cats.map((c) => (
                <CategoryRow key={c.id} category={c} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
