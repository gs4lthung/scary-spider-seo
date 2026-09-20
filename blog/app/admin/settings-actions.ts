"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/authz";
import { setPostsPerPage, setCommentsRequireApproval, setContentPrompt, setImagePrompt } from "@/lib/db/settings";

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

export async function updateContentPrompt(_prevState: string | null, formData: FormData): Promise<string | null> {
  await requirePermission("settings:write");
  const prompt = String(formData.get("prompt") ?? "").trim();
  if (!prompt) return "The prompt cannot be empty.";
  if (prompt.length > 50000) return "The prompt must be 50,000 characters or fewer.";

  await setContentPrompt(prompt);
  revalidatePath("/admin/prompts");
  redirect(`/admin/prompts?toast=${encodeURIComponent("Prompt saved")}`);
  return null;
}

export async function updateImagePrompt(_prevState: string | null, formData: FormData): Promise<string | null> {
  await requirePermission("settings:write");
  const prompt = String(formData.get("prompt") ?? "").trim();
  if (!prompt) return "The prompt cannot be empty.";
  if (prompt.length > 50000) return "The prompt must be 50,000 characters or fewer.";

  await setImagePrompt(prompt);
  revalidatePath("/admin/prompts");
  redirect(`/admin/prompts?toast=${encodeURIComponent("Image prompt saved")}`);
  return null;
}
