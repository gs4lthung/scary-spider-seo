"use client";

import { useActionState, useRef, useState } from "react";
import { uploadImage } from "@/app/admin/media-actions";
import { updateProfile } from "@/app/admin/users-actions";
import { fileToWebP } from "@/lib/webp";

export function ProfileForm({
  user,
}: {
  user: {
    id: number;
    username: string;
    displayName: string | null;
    avatarKey: string | null;
    jobTitle: string | null;
    bio: string | null;
    website: string | null;
    email: string | null;
    github: string | null;
    twitter: string | null;
    linkedin: string | null;
    facebook: string | null;
  };
}) {
  const [error, formAction, pending] = useActionState(updateProfile, null);
  const [avatarKey, setAvatarKey] = useState(user.avatarKey ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onAvatarSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", await fileToWebP(file));
      const result = await uploadImage(formData);
      if ("error" in result) {
        setUploadError(result.error);
        return;
      }
      setAvatarKey(result.url);
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={formAction} className="space-y-6 rounded-lg border border-border bg-card p-6">
      {error ? <p className="rounded border border-red-400 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <div>
        <label className="block text-sm font-medium">Avatar</label>
        <div className="mt-2 flex items-center gap-3">
          {avatarKey ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarKey} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-secondary text-lg font-semibold text-secondary-foreground">
              {(user.displayName || user.username).slice(0, 1).toUpperCase()}
            </div>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded border border-border px-3 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            {uploading ? "Uploading..." : avatarKey ? "Change avatar" : "Upload avatar"}
          </button>
          {avatarKey ? (
            <button type="button" onClick={() => setAvatarKey("")} className="text-sm text-red-600 hover:underline">
              Remove
            </button>
          ) : null}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onAvatarSelected} />
        </div>
        {uploadError ? <p className="mt-1 text-xs text-red-600">{uploadError}</p> : null}
        <input type="hidden" name="avatarKey" value={avatarKey} />
      </div>

      <div>
        <label htmlFor="profile-display-name" className="block text-sm font-medium">
          Display name
        </label>
        <input
          id="profile-display-name"
          name="displayName"
          defaultValue={user.displayName ?? ""}
          placeholder={user.username}
          className="mt-1 w-full rounded border px-3 py-2"
        />
        <p className="mt-1 text-xs text-muted-foreground">Shown publicly as the author (falls back to @{user.username}).</p>
      </div>

      <div>
        <label htmlFor="profile-job-title" className="block text-sm font-medium">
          Job title
        </label>
        <input id="profile-job-title" name="jobTitle" defaultValue={user.jobTitle ?? ""} className="mt-1 w-full rounded border px-3 py-2" />
      </div>

      <div>
        <label htmlFor="profile-bio" className="block text-sm font-medium">
          Profile description
        </label>
        <textarea id="profile-bio" name="bio" rows={4} defaultValue={user.bio ?? ""} className="mt-1 w-full rounded border px-3 py-2" />
      </div>

      <div className="rounded border border-border p-4">
        <p className="text-sm font-medium">Links</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Optional public links on your author page. You can enter a full URL or just a handle (e.g.
          &quot;facebook.com/name&quot;).
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="profile-website" className="block text-xs font-medium text-muted-foreground">
              Website
            </label>
            <input
              id="profile-website"
              name="website"
              defaultValue={user.website ?? ""}
              placeholder="https://yoursite.com"
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="profile-email" className="block text-xs font-medium text-muted-foreground">
              Email (public)
            </label>
            <input
              id="profile-email"
              name="email"
              defaultValue={user.email ?? ""}
              placeholder="you@example.com"
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="profile-github" className="block text-xs font-medium text-muted-foreground">
              GitHub
            </label>
            <input id="profile-github" name="github" defaultValue={user.github ?? ""} placeholder="github.com/username" className="mt-1 w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label htmlFor="profile-twitter" className="block text-xs font-medium text-muted-foreground">
              X / Twitter
            </label>
            <input id="profile-twitter" name="twitter" defaultValue={user.twitter ?? ""} placeholder="x.com/username" className="mt-1 w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label htmlFor="profile-linkedin" className="block text-xs font-medium text-muted-foreground">
              LinkedIn
            </label>
            <input id="profile-linkedin" name="linkedin" defaultValue={user.linkedin ?? ""} placeholder="linkedin.com/in/username" className="mt-1 w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label htmlFor="profile-facebook" className="block text-xs font-medium text-muted-foreground">
              Facebook
            </label>
            <input id="profile-facebook" name="facebook" defaultValue={user.facebook ?? ""} placeholder="facebook.com/username" className="mt-1 w-full rounded border px-3 py-2" />
          </div>
        </div>
      </div>

      <button type="submit" disabled={pending} className="rounded bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50">
        {pending ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}