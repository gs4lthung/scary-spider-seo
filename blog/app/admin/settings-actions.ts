"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { setPostsPerPage, setCommentsRequireApproval } from "@/lib/db/settings";

export async function updateSettings(_prevState: string | null, formData: FormData): Promise<string | null> {
  const session = await getSession();
  if (!session || session.role !== "admin") return "Only admins can change site settings.";

  const raw = Number(formData.get("postsPerPage"));
  if (!Number.isFinite(raw) || raw < 1) return "Posts per page must be a positive number.";

  await setPostsPerPage(raw);
  await setCommentsRequireApproval(formData.get("commentsRequireApproval") === "on");
  revalidatePath("/");
  revalidatePath("/admin/settings");
  return null;
}
