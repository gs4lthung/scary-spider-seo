"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import type { posts } from "@/lib/db/schema";
import { TITLE_MIN_LENGTH, TITLE_MAX_LENGTH, META_DESCRIPTION_TARGET_MAX, THIN_CONTENT_WORD_COUNT } from "@/lib/seo-limits";
import { RichTextEditor } from "@/components/RichTextEditor";
import { uploadImage } from "@/app/admin/media-actions";
import { fileToWebP } from "@/lib/webp";

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
}: {
  action: Action;
  post?: Post;
  categories: { id: number; name: string }[];
}) {
  const [error, formAction, pending] = useActionState(action, null);
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(post));
  const [metaTitle, setMetaTitle] = useState(post?.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(post?.metaDescription ?? "");
  const [wordCount, setWordCount] = useState(() => wordCountFromHtml(post?.content ?? ""));
  const [coverImageKey, setCoverImageKey] = useState(post?.coverImageKey ?? "");
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null);
  const coverFileInputRef = useRef<HTMLInputElement>(null);

  const effectiveTitleLength = (metaTitle || title).length;

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
    } catch {
      setCoverUploadError("Upload failed. Please try again.");
    } finally {
      setCoverUploading(false);
    }
  }

  return (
    <form action={formAction} className="space-y-6">
      {error ? <p className="rounded border border-red-400 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

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
            if (!slugTouched) setSlug(slugify(e.target.value));
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
            setSlugTouched(true);
            setSlug(slugify(e.target.value));
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
            {coverImageKey ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverImageKey} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
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
          <RichTextEditor name="content" initialContent={post?.content ?? ""} onChangeHTML={(html) => setWordCount(wordCountFromHtml(html))} />
        </div>
        <span className={`text-xs ${wordCount > 0 && wordCount < THIN_CONTENT_WORD_COUNT ? "text-amber-600" : "text-muted-foreground"}`}>
          {wordCount} words
          {wordCount > 0 && wordCount < THIN_CONTENT_WORD_COUNT ? ` — under ${THIN_CONTENT_WORD_COUNT} may read as thin content` : ""}
        </span>
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
        <button type="submit" disabled={pending} className="comic-panel rounded bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50">
          {pending ? "Saving..." : "Save post"}
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
