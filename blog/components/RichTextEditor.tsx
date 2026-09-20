"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, useEditorState, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle, FontSize } from "@tiptap/extension-text-style";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import {
  TextB,
  TextUnderline,
  TextItalic,
  TextHTwo,
  TextHThree,
  ListBullets,
  ListNumbers,
  Quotes,
  LinkSimple,
  LinkSimpleBreak,
  Code,
  CodeBlock,
  Table as TableIcon,
  Rows,
  RowsPlusBottom,
  Columns,
  ColumnsPlusRight,
  Trash,
  Image as ImageIcon,
  Images,
  ArrowCounterClockwise,
  ArrowClockwise,
} from "@phosphor-icons/react";
import { fileToWebP } from "@/lib/webp";
import type { PendingImage } from "@/lib/pending-images";
import { MediaPicker } from "@/components/MediaPicker";

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36];

type ToolbarState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  heading2: boolean;
  heading3: boolean;
  bulletList: boolean;
  orderedList: boolean;
  blockquote: boolean;
  link: boolean;
  code: boolean;
  codeBlock: boolean;
  table: boolean;
  fontSize: string;
  canUndo: boolean;
  canRedo: boolean;
};

const DEFAULT_TOOLBAR_STATE: ToolbarState = {
  bold: false,
  italic: false,
  underline: false,
  heading2: false,
  heading3: false,
  bulletList: false,
  orderedList: false,
  blockquote: false,
  link: false,
  code: false,
  codeBlock: false,
  table: false,
  fontSize: "",
  canUndo: false,
  canRedo: false,
};

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex h-8 w-8 items-center justify-center rounded ${
        active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"
      } disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({
  initialContent,
  onChangeHTML,
  onPendingImagesChange,
}: {
  initialContent: string;
  onChangeHTML?: (html: string) => void;
  onPendingImagesChange?: (images: PendingImage[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const changeFileInputRef = useRef<HTMLInputElement>(null);
  const changeTargetRef = useRef<string | null>(null);
  const createdUrlsRef = useRef<Set<string>>(new Set());
  const onChangeHTMLRef = useRef(onChangeHTML);
  const onPendingImagesChangeRef = useRef(onPendingImagesChange);

  // The image currently being added (before it is inserted into the post).
  const [pendingImage, setPendingImage] = useState<{ id: string; file: File; previewUrl: string; alt: string } | null>(null);
  // Images already inserted into the post but not yet uploaded to R2.
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  // Blob URL shown in the full-size preview modal.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // Whether the "insert from media library" picker is open.
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // Content headings start at H2 — the page title is always the real H1.
        heading: { levels: [2, 3, 4, 5, 6] },
      }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      Placeholder.configure({ placeholder: "Write the post..." }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TextStyle,
      FontSize,
    ],
    content: initialContent || "<p></p>",
    editorProps: {
      attributes: {
        class: "prose prose-brand max-w-none min-h-[320px] px-4 py-3 focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      onChangeHTMLRef.current?.(editor.getHTML());
    },
  });

  // Subscribe to the editor state so the toolbar reflects the current
  // selection (bold/italic/lists/font size, undo availability, ...). Without
  // this, `useEditor` in @tiptap/react v3 does not re-render on transactions,
  // so formatting already applied to the selected text would not light up.
  const toolbarState = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return DEFAULT_TOOLBAR_STATE;
      return {
        bold: editor.isActive("bold"),
        italic: editor.isActive("italic"),
        underline: editor.isActive("underline"),
        heading2: editor.isActive("heading", { level: 2 }),
        heading3: editor.isActive("heading", { level: 3 }),
        bulletList: editor.isActive("bulletList"),
        orderedList: editor.isActive("orderedList"),
        blockquote: editor.isActive("blockquote"),
        link: editor.isActive("link"),
        code: editor.isActive("code"),
        codeBlock: editor.isActive("codeBlock"),
        table: editor.isActive("table"),
        fontSize: String(editor.getAttributes("textStyle").fontSize ?? "").replace(/px$/i, ""),
        canUndo: editor.can().undo(),
        canRedo: editor.can().redo(),
      };
    },
  });
  const t = toolbarState ?? DEFAULT_TOOLBAR_STATE;

  useEffect(() => {
    onChangeHTMLRef.current = onChangeHTML;
  }, [onChangeHTML]);
  useEffect(() => {
    onPendingImagesChangeRef.current = onPendingImagesChange;
  }, [onPendingImagesChange]);

  // Close the preview modal with Escape.
  useEffect(() => {
    if (!previewUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewUrl(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewUrl]);

  // Revoke every blob URL this editor created once it unmounts.
  useEffect(() => {
    const created = createdUrlsRef.current;
    return () => {
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  if (!editor) return null;

  function trackUrl(url: string) {
    createdUrlsRef.current.add(url);
    return url;
  }

  function releaseUrl(url: string) {
    createdUrlsRef.current.delete(url);
    URL.revokeObjectURL(url);
  }

  function publishPendingImages(next: PendingImage[]) {
    setPendingImages(next);
    onPendingImagesChangeRef.current?.(next);
  }

  async function onAddFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const webpFile = await fileToWebP(file);
    const previewUrl = trackUrl(URL.createObjectURL(webpFile));
    if (pendingImage) {
      // Replacing the not-yet-inserted image.
      releaseUrl(pendingImage.previewUrl);
      setPendingImage({ id: pendingImage.id, file: webpFile, previewUrl, alt: pendingImage.alt });
    } else {
      setPendingImage({ id: crypto.randomUUID(), file: webpFile, previewUrl, alt: "" });
    }
  }

  async function onChangeFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    const id = changeTargetRef.current;
    changeTargetRef.current = null;
    if (!file || !id) return;
    await replacePendingImage(id, file);
  }

  function insertPendingImage() {
    if (!pendingImage || !editor) return;
    editor.chain().focus().setImage({ src: pendingImage.previewUrl, alt: pendingImage.alt || undefined }).run();
    publishPendingImages([
      ...pendingImages,
      { id: pendingImage.id, blobUrl: pendingImage.previewUrl, file: pendingImage.file, alt: pendingImage.alt },
    ]);
    setPendingImage(null);
  }

  function cancelPendingImage() {
    if (!pendingImage) return;
    releaseUrl(pendingImage.previewUrl);
    setPendingImage(null);
  }

  async function replacePendingImage(id: string, file: File) {
    const item = pendingImages.find((i) => i.id === id);
    if (!item) return;
    const webpFile = await fileToWebP(file);
    const newUrl = trackUrl(URL.createObjectURL(webpFile));
    updateImageNodeSrc(item.blobUrl, newUrl);
    releaseUrl(item.blobUrl);
    publishPendingImages(
      pendingImages.map((i) => (i.id === id ? { ...i, blobUrl: newUrl, file: webpFile } : i)),
    );
  }

  function removePendingImage(id: string) {
    const item = pendingImages.find((i) => i.id === id);
    if (!item) return;
    deleteImageNode(item.blobUrl);
    releaseUrl(item.blobUrl);
    publishPendingImages(pendingImages.filter((i) => i.id !== id));
  }

  // Find the first <img> node whose src matches and delete it (used when a
  // pending image is removed from the "not uploaded yet" list).
  function deleteImageNode(src: string) {
    if (!editor) return;
    const { state } = editor;
    const { tr } = state;
    let done = false;
    state.doc.descendants((node, pos) => {
      if (!done && node.type.name === "image" && node.attrs.src === src) {
        tr.delete(pos, pos + node.nodeSize);
        done = true;
      }
      return !done;
    });
    if (done) editor.view.dispatch(tr);
  }

  // Replace the src of the first matching <img> node (used when a pending
  // image is swapped for a different file).
  function updateImageNodeSrc(oldSrc: string, newSrc: string) {
    if (!editor) return;
    const { state } = editor;
    const { tr } = state;
    let done = false;
    state.doc.descendants((node, pos) => {
      if (!done && node.type.name === "image" && node.attrs.src === oldSrc) {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: newSrc });
        done = true;
      }
      return !done;
    });
    if (done) editor.view.dispatch(tr);
  }

  function insertLink() {
    if (!editor) return;
    if (editor.isActive("link")) {
      // Clicking the already-active Link button removes the link, so it
      // doubles as an "undo" without needing browser undo/redo.
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const url = window.prompt("Link URL");
    if (!url) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  function onFontSizeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    if (!editor) return;
    if (value === "") {
      editor.chain().focus().unsetFontSize().run();
    } else {
      editor.chain().focus().setFontSize(`${value}px`).run();
    }
  }

  return (
    <div className="rounded border border-border">
      <div className="flex flex-wrap items-center gap-1 border-b border-border p-1.5">
        <select
          value={t.fontSize}
          onChange={onFontSizeChange}
          title="Font size"
          aria-label="Font size"
          className="h-8 rounded border border-border bg-background px-1 text-xs"
        >
          <option value="">Size</option>
          {FONT_SIZES.map((size) => (
            <option key={size} value={String(size)}>
              {size}px
            </option>
          ))}
        </select>

        <span className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton label="Bold" active={t.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
          <TextB className="h-4 w-4" weight="bold" />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={t.italic}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <TextItalic className="h-4 w-4" weight="bold" />
        </ToolbarButton>
        <ToolbarButton
          label="Underline"
          active={t.underline}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <TextUnderline className="h-4 w-4" weight="bold" />
        </ToolbarButton>
        <ToolbarButton
          label="Heading 2"
          active={t.heading2}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <TextHTwo className="h-4 w-4" weight="bold" />
        </ToolbarButton>
        <ToolbarButton
          label="Heading 3"
          active={t.heading3}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <TextHThree className="h-4 w-4" weight="bold" />
        </ToolbarButton>
        <ToolbarButton
          label="Bullet list"
          active={t.bulletList}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <ListBullets className="h-4 w-4" weight="bold" />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={t.orderedList}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListNumbers className="h-4 w-4" weight="bold" />
        </ToolbarButton>
        <ToolbarButton
          label="Quote"
          active={t.blockquote}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quotes className="h-4 w-4" weight="bold" />
        </ToolbarButton>
        <ToolbarButton label={t.link ? "Remove link" : "Link"} active={t.link} onClick={insertLink}>
          {t.link ? (
            <LinkSimpleBreak className="h-4 w-4" weight="bold" />
          ) : (
            <LinkSimple className="h-4 w-4" weight="bold" />
          )}
        </ToolbarButton>
        <ToolbarButton label="Insert image" onClick={() => fileInputRef.current?.click()}>
          <ImageIcon className="h-4 w-4" weight="bold" />
        </ToolbarButton>
        <ToolbarButton label="Insert from media library" onClick={() => setMediaPickerOpen(true)}>
          <Images className="h-4 w-4" weight="bold" />
        </ToolbarButton>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onAddFileSelected} />
        <input ref={changeFileInputRef} type="file" accept="image/*" className="hidden" onChange={onChangeFileSelected} />

        <span className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton label="Inline code" active={t.code} onClick={() => editor.chain().focus().toggleCode().run()}>
          <Code className="h-4 w-4" weight="bold" />
        </ToolbarButton>
        <ToolbarButton
          label="Code block"
          active={t.codeBlock}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <CodeBlock className="h-4 w-4" weight="bold" />
        </ToolbarButton>
        <ToolbarButton
          label="Insert table"
          active={t.table}
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          <TableIcon className="h-4 w-4" weight="bold" />
        </ToolbarButton>

        <span className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton
          label="Undo"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!t.canUndo}
        >
          <ArrowCounterClockwise className="h-4 w-4" weight="bold" />
        </ToolbarButton>
        <ToolbarButton
          label="Redo"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!t.canRedo}
        >
          <ArrowClockwise className="h-4 w-4" weight="bold" />
        </ToolbarButton>
      </div>

      {t.table ? (
        <div className="flex flex-wrap items-center gap-1 border-b border-border bg-secondary p-1.5">
          <span className="px-1 text-xs text-muted-foreground">Table:</span>
          <ToolbarButton label="Add column after" onClick={() => editor.chain().focus().addColumnAfter().run()}>
            <ColumnsPlusRight className="h-4 w-4" weight="bold" />
          </ToolbarButton>
          <ToolbarButton label="Add row after" onClick={() => editor.chain().focus().addRowAfter().run()}>
            <RowsPlusBottom className="h-4 w-4" weight="bold" />
          </ToolbarButton>
          <ToolbarButton label="Delete column" onClick={() => editor.chain().focus().deleteColumn().run()}>
            <Columns className="h-4 w-4" weight="bold" />
          </ToolbarButton>
          <ToolbarButton label="Delete row" onClick={() => editor.chain().focus().deleteRow().run()}>
            <Rows className="h-4 w-4" weight="bold" />
          </ToolbarButton>
          <ToolbarButton label="Delete table" onClick={() => editor.chain().focus().deleteTable().run()}>
            <Trash className="h-4 w-4" weight="bold" />
          </ToolbarButton>
        </div>
      ) : null}

      {pendingImage ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-secondary p-3">
          <button
            type="button"
            onClick={() => setPreviewUrl(pendingImage.previewUrl)}
            title="Preview"
            className="shrink-0 overflow-hidden rounded"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pendingImage.previewUrl} alt="" className="h-12 w-12 object-cover" />
          </button>
          <input
            autoFocus
            placeholder="Alt text (describe the image)"
            value={pendingImage.alt}
            onChange={(e) => setPendingImage({ ...pendingImage, alt: e.target.value })}
            className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded border border-border px-3 py-1 text-sm hover:bg-background"
          >
            Change
          </button>
          <button
            type="button"
            onClick={insertPendingImage}
            disabled={!pendingImage.alt.trim()}
            className="rounded bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Add to post
          </button>
          <button type="button" onClick={cancelPendingImage} className="text-sm text-muted-foreground">
            Cancel
          </button>
        </div>
      ) : null}

      <EditorContent editor={editor} />

      {pendingImages.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-border bg-secondary/50 p-3">
          <span className="text-xs font-medium text-muted-foreground">Not uploaded yet (saved with the post):</span>
          {pendingImages.map((img) => (
            <div key={img.id} className="flex items-center gap-2 rounded border border-border bg-background p-1.5">
              <button
                type="button"
                onClick={() => setPreviewUrl(img.blobUrl)}
                title="Preview"
                className="shrink-0 overflow-hidden rounded"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.blobUrl} alt={img.alt} className="h-12 w-12 object-cover" />
              </button>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => {
                    changeTargetRef.current = img.id;
                    changeFileInputRef.current?.click();
                  }}
                  className="text-left text-xs text-primary hover:underline"
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={() => removePendingImage(img.id)}
                  className="text-left text-xs text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {mediaPickerOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setMediaPickerOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl rounded-lg bg-background shadow-xl">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h2 className="text-sm font-semibold">Insert from media library</h2>
              <button
                type="button"
                onClick={() => setMediaPickerOpen(false)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>
            <MediaPicker
              onSelect={(src) => {
                editor.chain().focus().setImage({ src, alt: "" }).run();
                setMediaPickerOpen(false);
              }}
            />
          </div>
        </div>
      ) : null}

      {previewUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setPreviewUrl(null)}
          role="dialog"
          aria-modal="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Image preview"
            className="max-h-full max-w-full rounded-lg shadow-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}