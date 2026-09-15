"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import {
  TextB,
  TextItalic,
  TextHTwo,
  TextHThree,
  ListBullets,
  ListNumbers,
  Quotes,
  LinkSimple,
  Image as ImageIcon,
  ArrowCounterClockwise,
  ArrowClockwise,
} from "@phosphor-icons/react";
import { uploadImage } from "@/app/admin/media-actions";

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
  name,
  initialContent,
  onChangeHTML,
}: {
  name: string;
  initialContent: string;
  onChangeHTML?: (html: string) => void;
}) {
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string; alt: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
    ],
    content: initialContent || "<p></p>",
    editorProps: {
      attributes: {
        class: "prose prose-brand max-w-none min-h-[320px] px-4 py-3 focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (hiddenInputRef.current) hiddenInputRef.current.value = html;
      onChangeHTML?.(html);
    },
  });

  useEffect(() => {
    if (editor && hiddenInputRef.current) hiddenInputRef.current.value = editor.getHTML();
  }, [editor]);

  if (!editor) return null;

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    setPendingImage({ file, previewUrl: URL.createObjectURL(file), alt: "" });
  }

  async function confirmInsertImage() {
    if (!pendingImage) return;
    setUploading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.set("file", pendingImage.file);
    const result = await uploadImage(formData);
    setUploading(false);

    if ("error" in result) {
      setUploadError(result.error);
      return;
    }

    editor?.chain().focus().setImage({ src: result.url, alt: pendingImage.alt || undefined }).run();
    URL.revokeObjectURL(pendingImage.previewUrl);
    setPendingImage(null);
  }

  function cancelInsertImage() {
    if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    setPendingImage(null);
    setUploadError(null);
  }

  function insertLink() {
    const url = window.prompt("Link URL");
    if (!url || !editor) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div className="rounded border border-border">
      <div className="flex flex-wrap items-center gap-1 border-b border-border p-1.5">
        <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <TextB className="h-4 w-4" weight="bold" />
        </ToolbarButton>
        <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <TextItalic className="h-4 w-4" weight="bold" />
        </ToolbarButton>
        <ToolbarButton
          label="Heading 2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <TextHTwo className="h-4 w-4" weight="bold" />
        </ToolbarButton>
        <ToolbarButton
          label="Heading 3"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <TextHThree className="h-4 w-4" weight="bold" />
        </ToolbarButton>
        <ToolbarButton
          label="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <ListBullets className="h-4 w-4" weight="bold" />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListNumbers className="h-4 w-4" weight="bold" />
        </ToolbarButton>
        <ToolbarButton
          label="Quote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quotes className="h-4 w-4" weight="bold" />
        </ToolbarButton>
        <ToolbarButton label="Link" active={editor.isActive("link")} onClick={insertLink}>
          <LinkSimple className="h-4 w-4" weight="bold" />
        </ToolbarButton>
        <ToolbarButton label="Insert image" onClick={() => fileInputRef.current?.click()}>
          <ImageIcon className="h-4 w-4" weight="bold" />
        </ToolbarButton>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileSelected} />

        <span className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
          <ArrowCounterClockwise className="h-4 w-4" weight="bold" />
        </ToolbarButton>
        <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
          <ArrowClockwise className="h-4 w-4" weight="bold" />
        </ToolbarButton>
      </div>

      {pendingImage ? (
        <div className="flex items-center gap-3 border-b border-border bg-secondary p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pendingImage.previewUrl} alt="" className="h-12 w-12 rounded object-cover" />
          <input
            autoFocus
            placeholder="Alt text (describe the image)"
            value={pendingImage.alt}
            onChange={(e) => setPendingImage({ ...pendingImage, alt: e.target.value })}
            className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={confirmInsertImage}
            disabled={uploading || !pendingImage.alt.trim()}
            className="rounded bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Insert"}
          </button>
          <button type="button" onClick={cancelInsertImage} className="text-sm text-muted-foreground">
            Cancel
          </button>
        </div>
      ) : null}
      {uploadError ? <p className="border-b border-border bg-red-50 p-2 text-xs text-red-700">{uploadError}</p> : null}

      <EditorContent editor={editor} />
      <input ref={hiddenInputRef} type="hidden" name={name} defaultValue={initialContent} />
    </div>
  );
}
