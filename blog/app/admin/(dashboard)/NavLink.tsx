"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SquaresFour, Plus, Tag, Users } from "@phosphor-icons/react";

const ICONS = {
  dashboard: SquaresFour,
  new: Plus,
  categories: Tag,
  users: Users,
} as const;

export function NavLink({
  href,
  exact,
  icon,
  children,
}: {
  href: string;
  exact?: boolean;
  icon: keyof typeof ICONS;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);
  const Icon = ICONS[icon];

  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium ${
        active ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" weight={active ? "bold" : "regular"} />
      {children}
    </Link>
  );
}
