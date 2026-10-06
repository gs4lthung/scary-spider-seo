// Client-side image upload: POSTs the raw file bytes to the /admin/upload
// route handler (app/admin/upload/route.ts). Same result shape the old
// `uploadImage` server action returned, so callers just show `error`.
export async function uploadImageFile(file: File): Promise<{ url: string } | { error: string }> {
  const response = await fetch("/admin/upload", {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name),
    },
    body: file,
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as { url: string } | { error: string };
  }
  // An HTML page instead of JSON: a login redirect after the session expired,
  // or something in front of the Worker (e.g. a Cloudflare block page, which
  // BlockedResponseModal also shows in full).
  if (response.redirected && new URL(response.url).pathname === "/admin/login") {
    return { error: "Your session has expired. Log in again, then retry the upload." };
  }
  return { error: `Upload failed (HTTP ${response.status}).` };
}
