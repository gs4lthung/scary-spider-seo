import Link from "next/link";
import { desc } from "drizzle-orm";
import { FileText, CheckCircle, PencilSimple, Tag, Plus } from "@phosphor-icons/react/dist/ssr";
import { getDb } from "@/lib/db/client";
import { posts } from "@/lib/db/schema";
import { getPostStats } from "@/lib/db/queries";
import { postPath } from "@/lib/post-url";
import { deletePost } from "@/app/admin/posts-actions";
import { DeleteButton } from "@/app/admin/DeleteButton";

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string; weight?: "regular" | "bold" }>;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: "draft" | "published" }) {
  return status === "published" ? (
    <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
      Published
    </span>
  ) : (
    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
      Draft
    </span>
  );
}

export default async function AdminDashboardPage() {
  const db = await getDb();
  const [allPosts, stats] = await Promise.all([
    db.select().from(posts).orderBy(desc(posts.updatedAt)),
    getPostStats(),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">An overview of the blog and its posts.</p>
        </div>
        <Link
          href="/admin/new"
          className="flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" weight="bold" />
          New post
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total posts" value={stats.total} icon={FileText} />
        <StatCard label="Published" value={stats.published} icon={CheckCircle} />
        <StatCard label="Drafts" value={stats.draft} icon={PencilSimple} />
        <StatCard label="Categories" value={stats.categories} icon={Tag} />
      </div>

      <div className="mt-10">
        <h2 className="text-sm font-semibold text-muted-foreground">All posts</h2>

        {allPosts.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border py-16 text-center">
            <p className="font-semibold">No posts yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">Create your first post to see it here.</p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-card text-xs text-muted-foreground uppercase">
                  <th className="px-4 py-3 font-semibold">Title</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Updated</th>
                  <th className="px-4 py-3 font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allPosts.map((post) => (
                  <tr key={post.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{post.title}</p>
                      <p className="text-xs text-muted-foreground">{postPath(post)}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{post.category ?? "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={post.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {post.updatedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <Link href={`/admin/${post.id}/edit`} className="text-primary hover:underline">
                          Edit
                        </Link>
                        <form action={deletePost.bind(null, post.id)}>
                          <DeleteButton />
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
