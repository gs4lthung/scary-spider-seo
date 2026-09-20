import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowSquareOut, SignOut } from "@phosphor-icons/react/dist/ssr";
import { logout } from "@/app/admin/login/actions";
import { getCurrentUser } from "@/lib/session";
import { getPendingCommentCount } from "@/lib/db/comment-queries";
import { SITE_URL } from "@/lib/site";
import { NavLink } from "./NavLink";

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-3 text-xs font-semibold tracking-wide text-muted-foreground/70 uppercase">{label}</p>
      <div className="mt-1.5 space-y-0.5">{children}</div>
    </div>
  );
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentUser();
  if (!session) redirect("/admin/login");

  const pendingComments = await getPendingCommentCount();

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-border bg-card px-4 py-6">
        <Link href="/admin" className="px-2 text-lg font-bold tracking-tight">
          Scary Spider SEO
          <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 align-middle text-xs font-semibold text-primary">Admin</span>
        </Link>

        <nav className="mt-8 flex-1 space-y-6">
          <NavGroup label="Content">
            <NavLink href="/admin" exact icon="dashboard">
              Dashboard
            </NavLink>
            <NavLink href="/admin/new" exact icon="new">
              New post
            </NavLink>
            <NavLink href="/admin/categories" icon="categories">
              Categories
            </NavLink>
            <NavLink href="/admin/comments" icon="comments" badge={pendingComments}>
              Comments
            </NavLink>
            <NavLink href="/admin/media" icon="media">
              Media
            </NavLink>
          </NavGroup>

          <NavGroup label="Account">
            <NavLink href="/admin/profile" icon="profile">
              My profile
            </NavLink>
          </NavGroup>

          {session.role === "admin" ? (
            <NavGroup label="Admin">
              <NavLink href="/admin/users" icon="users">
                Users
              </NavLink>
              <NavLink href="/admin/settings" icon="settings">
                Settings
              </NavLink>
            </NavGroup>
          ) : null}
        </nav>

        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center gap-2.5 px-1">
            {session.avatarKey ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.avatarKey} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {session.username.trim().slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{session.username}</p>
              <p className="text-xs text-muted-foreground capitalize">{session.role}</p>
            </div>
          </div>

          <a
            href={SITE_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <ArrowSquareOut className="h-4 w-4" />
            View site
          </a>
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <SignOut className="h-4 w-4" />
              Log out
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-10 py-10">{children}</main>
    </div>
  );
}
