import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/session";
import { ProfileForm } from "./ProfileForm";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default async function ProfilePage() {
  const session = await getCurrentUser();
  if (!session) redirect("/admin/login");

  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, session.userId));
  if (!user) redirect("/admin/login");

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">My profile</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        This is the public author profile shown on your posts and at /author/{user.username}.
      </p>
      <div className="mt-8">
        <ProfileForm user={user} />
      </div>
      <div className="mt-10">
        <h2 className="text-lg font-bold">Change password</h2>
        <p className="mt-1 text-sm text-muted-foreground">Updates the password for your next sign-in.</p>
        <div className="mt-4 rounded-lg border border-border bg-card p-6">
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}