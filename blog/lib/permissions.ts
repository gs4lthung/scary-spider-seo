import type { Role } from "./auth";

export type Permission = "posts:write" | "categories:write" | "users:write";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: ["posts:write", "categories:write", "users:write"],
  editor: ["posts:write", "categories:write"],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
