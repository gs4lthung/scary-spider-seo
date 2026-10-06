import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getContentPrompt } from "@/lib/db/settings";
import { getImagePrompt } from "@/lib/db/settings";
import { getLinkablePosts } from "@/lib/db/queries";
import { buildInternalLinkLibrary, withInternalLinkLibrary } from "@/lib/content-prompt";
import { PromptForm } from "./PromptForm";
import { ImagePromptForm } from "./ImagePromptForm";

export default async function PromptsPage() {
  const session = await getCurrentUser();
  if (!session || session.role !== "admin") redirect("/admin");

  const [prompt, imagePrompt, linkablePosts] = await Promise.all([getContentPrompt(), getImagePrompt(), getLinkablePosts()]);
  const linkLibrary = buildInternalLinkLibrary(linkablePosts);

  return (
    <div>
      <h1 className="text-2xl font-bold">Content prompts</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Maintain the base prompt you paste into Gemini when creating SEO blog drafts. Keep the editorial rules here so every draft follows the same voice and structure.
      </p>
      <div className="mt-6">
        <PromptForm prompt={prompt} copyText={withInternalLinkLibrary(prompt, linkLibrary)} />
      </div>
      <section className="mt-6 max-w-5xl rounded-lg border border-border bg-card p-5">
        <h2 className="font-semibold">Internal link library</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Built from your {linkablePosts.length} published post{linkablePosts.length === 1 ? "" : "s"}. &quot;Copy prompt&quot; fills this list in at the
          [INTERNAL LINK LIBRARY] placeholder (or appends it if the placeholder is missing), so drafts only link to posts that exist.
        </p>
        <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded border border-border bg-background px-3 py-2 font-mono text-xs leading-5">{linkLibrary}</pre>
      </section>
      <div className="mt-6">
        <ImagePromptForm prompt={imagePrompt} />
      </div>
    </div>
  );
}
