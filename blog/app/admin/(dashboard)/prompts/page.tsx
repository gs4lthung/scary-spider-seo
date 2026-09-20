import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getContentPrompt } from "@/lib/db/settings";
import { getImagePrompt } from "@/lib/db/settings";
import { PromptForm } from "./PromptForm";
import { ImagePromptForm } from "./ImagePromptForm";

export default async function PromptsPage() {
  const session = await getCurrentUser();
  if (!session || session.role !== "admin") redirect("/admin");

  const [prompt, imagePrompt] = await Promise.all([getContentPrompt(), getImagePrompt()]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Content prompts</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Maintain the base prompt you paste into Gemini when creating SEO blog drafts. Keep the editorial rules here so every draft follows the same voice and structure.
      </p>
      <div className="mt-6">
        <PromptForm prompt={prompt} />
      </div>
      <div className="mt-6">
        <ImagePromptForm prompt={imagePrompt} />
      </div>
    </div>
  );
}
