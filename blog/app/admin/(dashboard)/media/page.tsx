import { listMediaImages } from "@/app/admin/media-actions";
import { MediaGallery } from "./MediaGallery";

export default async function MediaPage() {
  const { items, cursor } = await listMediaImages({});

  return (
    <div className="max-w-5xl">
      <h1 className="mb-2 text-2xl font-bold">Media library</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Every image uploaded to the blog. Copy a URL to reuse it (e.g. as a cover image), or insert it into a post
        from the editor&apos;s image button.
      </p>
      <MediaGallery initialItems={items} initialCursor={cursor} />
    </div>
  );
}