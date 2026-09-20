import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPostsPerPage, getCommentsRequireApproval } from "@/lib/db/settings";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/admin");

  const [postsPerPage, commentsRequireApproval] = await Promise.all([getPostsPerPage(), getCommentsRequireApproval()]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">Site-wide configuration for the public blog.</p>

      <div className="mt-6">
        <SettingsForm postsPerPage={postsPerPage} commentsRequireApproval={commentsRequireApproval} />
      </div>
    </div>
  );
}
