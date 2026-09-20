import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/session";
import { UserRow } from "./UserRow";
import { CreateUserForm } from "./CreateUserForm";

export default async function UsersPage() {
  const session = await getCurrentUser();
  if (!session || session.role !== "admin") redirect("/admin");

  const db = await getDb();
  const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));

  return (
    <div>
      <h1 className="text-2xl font-bold">Users</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Admins can manage posts, categories, and other users. Editors can manage posts and categories.
      </p>

      <div className="mt-6">
        <CreateUserForm />
      </div>

      <div className="mt-8 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-card text-xs text-muted-foreground uppercase">
              <th className="px-4 py-3 font-semibold">Username</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Created</th>
              <th className="px-4 py-3 font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {allUsers.map((user) => (
              <UserRow key={user.id} user={user} isSelf={user.id === session.userId} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
