"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import Link from "next/link";
import type { posts } from "@/lib/db/schema";
import { TITLE_MIN_LENGTH, TITLE_MAX_LENGTH, META_DESCRIPTION_TARGET_MAX, THIN_CONTENT_WORD_COUNT } from "@/lib/seo-limits";
import { RichTextEditor } from "@/components/RichTextEditor";
import { uploadImage } from "@/app/admin/media-actions";
import { fileToWebP } from "@/lib/webp";
import { resolvePendingImageUploads, type PendingImage } from "@/lib/pending-images";
import { useUnsavedChangesWarning } from "@/lib/use-unsaved-changes";
import { parseFaqs, parseTakeaways, type PostFaq } from "@/lib/post-sections";

type Post = typeof posts.$inferSelect;

type Action = (prevState: string | null, formData: FormData) => Promise<string | null>;

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function wordCountFromHtml(html: string) {
  const text = html.replace(/<[^>]*>/g, " ").trim();
  return text ? text.split(/\s+/).length : 0;
}

function toSafeImageSrc(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  // Allow only site-relative paths.
  if (trimmed.startsWith("/")) return trimmed;

  try {
    const parsed = new URL(trimmed);
    const isHttp = parsed.protocol === "http:" || parsed.protocol === "https:";
    const trustedHosts = new Set(["localhost", "your-domain.com", "www.your-domain.com"]);
    if (isHttp && trustedHosts.has(parsed.hostname)) {
      return parsed.toString();
    }
  } catch {
    // Invalid URL; fall through to empty string.
  }

  return "";
}

function CharCounter({ length, min, max }: { length: number; min?: number; max: number }) {
  const tooShort = min !== undefined && length > 0 && length < min;
  const tooLong = length > max;
  const color = tooShort || tooLong ? "text-red-600" : "text-muted-foreground";
  return (
    <span className={`text-xs ${color}`}>
      {length}/{max} chars{tooShort ? ` — under ${min} is too short for SEO` : ""}
      {tooLong ? " — trim this for SEO" : ""}
    </span>
  );
}

export function PostForm({
  action,
  post,
  categories,
  authors,
  defaultAuthorId,
}: {
  action: Action;
  post?: Post;
  categories: { id: number; name: string }[];
  authors: { id: number; username: string; displayName: string | null }[];
  defaultAuthorId?: number | null;
}) {
  const [error, formAction, pending] = useActionState(action, null);
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  // False until the user edits the slug by hand, so the title keeps driving
  // the slug (including on the edit page). Clearing the slug resets it back
  // to false so title-driven generation resumes.
  const [slugTouched, setSlugTouched] = useState(false);
  const [metaTitle, setMetaTitle] = useState(post?.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(post?.metaDescription ?? "");
  const [wordCount, setWordCount] = useState(() => wordCountFromHtml(post?.content ?? ""));
  const [authorId, setAuthorId] = useState(
    post?.authorId ? String(post.authorId) : defaultAuthorId ? String(defaultAuthorId) : "",
  );
  const [faqs, setFaqs] = useState<PostFaq[]>(() => parseFaqs(post?.faqs ?? null));
  const [coverImageKey, setCoverImageKey] = useState(post?.coverImageKey ?? "");
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  // The content HTML lives in a ref (mirrored into the hidden input below)
  // so the submit handler can upload pending images and rewrite the HTML
  // before the form's server action ever reads it.
  const contentRef = useRef(post?.content ?? "");
  const contentHiddenRef = useRef<HTMLInputElement>(null);
  const pendingImagesRef = useRef<PendingImage[]>([]);

  // Warn before leaving with unsaved changes; disabled while a save or the
  // pre-save image upload is in flight so the redirect never prompts.
  useUnsavedChangesWarning(dirty && !pending && !submitting);

  const effectiveTitleLength = (metaTitle || title).length;
  const safeCoverImageSrc = toSafeImageSrc(coverImageKey);

  async function onFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    // With no pending (not-yet-uploaded) images there is nothing to rewrite,
    // so let the form submit natively through React's server action. This is
    // the reliable path: preventDefault + requestSubmit() does NOT re-trigger
    // a React server action.
    if (pendingImagesRef.current.length === 0) return;

    e.preventDefault();
    const form = e.currentTarget;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const finalHtml = await resolvePendingImageUploads(contentRef.current, pendingImagesRef.current);
      const formData = new FormData(form);
      formData.set("content", finalHtml);
      setSubmitting(false);
      startTransition(() => {
        formAction(formData);
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to upload images.");
      setSubmitting(false);
    }
  }

  async function onCoverFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCoverUploadError(null);
    setCoverUploading(true);
    const formData = new FormData();
    formData.set("file", await fileToWebP(file));
    try {
      const result = await uploadImage(formData);
      if ("error" in result) {
        setCoverUploadError(result.error);
        return;
      }
      setCoverImageKey(result.url);
      setDirty(true);
    } catch {
      setCoverUploadError("Upload failed. Please try again.");
    } finally {
      setCoverUploading(false);
    }
  }

  return (
    <form action={formAction} onSubmit={onFormSubmit} onChange={() => setDirty(true)} className="space-y-6">
      {error || submitError ? (
        <p className="rounded border border-red-400 bg-red-50 p-3 text-sm text-red-700">{submitError ?? error}</p>
      ) : null}

      <div>
        <label htmlFor="title" className="block text-sm font-medium">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!slugTouched || slug === "") setSlug(slugify(e.target.value));
          }}
          className="mt-1 w-full rounded border px-3 py-2"
        />
        <CharCounter length={title.length} min={TITLE_MIN_LENGTH} max={TITLE_MAX_LENGTH} />
      </div>

      <div>
        <label htmlFor="slug" className="block text-sm font-medium">
          Slug (URL: /{slug || "your-slug"})
        </label>
        <input
          id="slug"
          name="slug"
          required
          value={slug}
          onChange={(e) => {
            const next = slugify(e.target.value);
            setSlug(next);
            // An emptied slug hands control back to the title.
            setSlugTouched(next !== "");
          }}
          className="mt-1 w-full rounded border px-3 py-2 font-mono text-sm"
        />
      </div>

      <div>
        <label htmlFor="metaTitle" className="block text-sm font-medium">
          SEO title override <span className="text-muted-foreground">(optional — falls back to Title)</span>
        </label>
        <input
          id="metaTitle"
          name="metaTitle"
          value={metaTitle}
          onChange={(e) => setMetaTitle(e.target.value)}
          className="mt-1 w-full rounded border px-3 py-2"
        />
        <CharCounter length={effectiveTitleLength} min={TITLE_MIN_LENGTH} max={TITLE_MAX_LENGTH} />
      </div>

      <div>
        <label htmlFor="metaDescription" className="block text-sm font-medium">
          Meta description
        </label>
        <textarea
          id="metaDescription"
          name="metaDescription"
          rows={2}
          required
          value={metaDescription}
          onChange={(e) => setMetaDescription(e.target.value)}
          className="mt-1 w-full rounded border px-3 py-2"
        />
        <CharCounter length={metaDescription.length} max={META_DESCRIPTION_TARGET_MAX} />
      </div>

      <div>
        <label htmlFor="excerpt" className="block text-sm font-medium">
          Excerpt <span className="text-muted-foreground">(shown on the blog listing)</span>
        </label>
        <textarea
          id="excerpt"
          name="excerpt"
          rows={2}
          defaultValue={post?.excerpt ?? ""}
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="author" className="block text-sm font-medium">
          Author <span className="text-muted-foreground">(shown as the author card on the post)</span>
        </label>
        <select
          id="author"
          name="authorId"
          value={authorId}
          onChange={(e) => setAuthorId(e.target.value)}
          className="mt-1 w-full max-w-xs rounded border bg-background px-3 py-2"
        >
          <option value="">Unassigned</option>
          {authors.map((a) => (
            <option key={a.id} value={String(a.id)}>
              {a.displayName || a.username}
            </option>
          ))}
        </select>
        {authors.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            No users yet — add one on the{" "}
            <Link href="/admin/users" className="text-primary hover:underline">
              Users
            </Link>{" "}
            page.
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="category" className="block text-sm font-medium">
          Category <span className="text-muted-foreground">(optional — shown as a pill on the card)</span>
        </label>
        <select
          id="category"
          name="category"
          defaultValue={post?.category ?? ""}
          className="mt-1 w-full max-w-xs rounded border bg-background px-3 py-2"
        >
          <option value="">None</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        {categories.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            No categories yet — add one on the{" "}
            <Link href="/admin/categories" className="text-primary hover:underline">
              Categories
            </Link>{" "}
            page.
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="coverImageKey" className="block text-sm font-medium">
            Cover image <span className="text-muted-foreground">(optional)</span>
          </label>
          <div className="mt-1 flex items-center gap-2">
            {safeCoverImageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={safeCoverImageSrc} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
            ) : null}
            <input
              id="coverImageKey"
              name="coverImageKey"
              placeholder="Uploaded URL, or paste an external image URL"
              value={coverImageKey}
              onChange={(e) => setCoverImageKey(e.target.value)}
              className="w-full rounded border px-3 py-2 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => coverFileInputRef.current?.click()}
              disabled={coverUploading}
              className="shrink-0 rounded border border-border px-3 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
            >
              {coverUploading ? "Uploading..." : "Upload"}
            </button>
            <input
              ref={coverFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onCoverFileSelected}
            />
          </div>
          {coverUploadError ? <p className="mt-1 text-xs text-red-600">{coverUploadError}</p> : null}
        </div>
        <div>
          <label htmlFor="coverImageAlt" className="block text-sm font-medium">
            Cover image alt text {coverImageKey ? <span className="text-red-600">(required)</span> : null}
          </label>
          <input
            id="coverImageAlt"
            name="coverImageAlt"
            required={Boolean(coverImageKey)}
            defaultValue={post?.coverImageAlt ?? ""}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">Content</label>
        <div className="mt-1">
          <RichTextEditor
            initialContent={post?.content ?? ""}
            onChangeHTML={(html) => {
              contentRef.current = html;
              if (contentHiddenRef.current) contentHiddenRef.current.value = html;
              setWordCount(wordCountFromHtml(html));
              setDirty(true);
            }}
            onPendingImagesChange={(images) => {
              pendingImagesRef.current = images;
            }}
          />
        </div>
        {/* Content HTML is mirrored into this hidden field so the server
            action receives the latest editor state. Owned here (not inside
            the editor) so it is never remounted or reset. */}
        <input ref={contentHiddenRef} type="hidden" name="content" defaultValue={post?.content ?? ""} />
        <span className={`text-xs ${wordCount > 0 && wordCount < THIN_CONTENT_WORD_COUNT ? "text-amber-600" : "text-muted-foreground"}`}>
          {wordCount} words
          {wordCount > 0 && wordCount < THIN_CONTENT_WORD_COUNT ? ` — under ${THIN_CONTENT_WORD_COUNT} may read as thin content` : ""}
        </span>
      </div>

      <div>
        <label htmlFor="keyTakeaways" className="block text-sm font-medium">
          Key takeaways <span className="text-muted-foreground">(optional — one per line, shown as a bulleted box)</span>
        </label>
        <textarea
          id="keyTakeaways"
          name="keyTakeaways"
          rows={4}
          defaultValue={parseTakeaways(post?.keyTakeaways ?? null).join("\n")}
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">
          FAQs <span className="text-muted-foreground">(optional — rendered as Q&amp;A with FAQ schema)</span>
        </label>
        <div className="mt-2 space-y-3">
          {faqs.map((faq, index) => (
            <div key={index} className="rounded border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Question {index + 1}</span>
                <button
                  type="button"
                  onClick={() => setFaqs((list) => list.filter((_, i) => i !== index))}
                  className="text-xs text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
              <input
                value={faq.question}
                onChange={(e) => setFaqs((list) => list.map((f, i) => (i === index ? { ...f, question: e.target.value } : f)))}
                placeholder="Question"
                className="mt-2 w-full rounded border px-3 py-2"
              />
              <textarea
                value={faq.answer}
                onChange={(e) => setFaqs((list) => list.map((f, i) => (i === index ? { ...f, answer: e.target.value } : f)))}
                placeholder="Answer"
                rows={3}
                className="mt-2 w-full rounded border px-3 py-2"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setFaqs((list) => [...list, { question: "", answer: "" }])}
            className="rounded border border-border px-3 py-1.5 text-sm font-medium hover:bg-secondary"
          >
            Add FAQ
          </button>
        </div>
        <input type="hidden" name="faqs" value={JSON.stringify(faqs)} />
      </div>

      <div>
        <label htmlFor="status" className="block text-sm font-medium">
          Status
        </label>
        <select id="status" name="status" defaultValue={post?.status ?? "draft"} className="mt-1 rounded border px-3 py-2">
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </div>

      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending || submitting} className="comic-panel rounded bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50">
          {pending || submitting ? "Saving..." : "Save post"}
        </button>
        {post ? (
          <Link href={`/admin/preview/${post.id}`} target="_blank" className="text-sm text-primary hover:underline">
            Preview →
          </Link>
        ) : null}
      </div>
    </form>
  );
}
