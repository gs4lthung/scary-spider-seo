"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/authz";
import { setPostsPerPage, setCommentsRequireApproval } from "@/lib/db/settings";

export async function updateSettings(_prevState: string | null, formData: FormData): Promise<string | null> {
  await requirePermission("settings:write");

  const raw = Number(formData.get("postsPerPage"));
  if (!Number.isFinite(raw) || raw < 1) return "Posts per page must be a positive number.";

  await setPostsPerPage(raw);
  await setCommentsRequireApproval(formData.get("commentsRequireApproval") === "on");
  revalidatePath("/");
  revalidatePath("/admin/settings");
  redirect(`/admin/settings?toast=${encodeURIComponent("Settings saved")}`);
  return null;
}
