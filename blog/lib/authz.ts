import { getCurrentUser } from "./session";
import { can, type Permission } from "./permissions";
import type { SessionPayload } from "./auth";

export async function requireUser(): Promise<SessionPayload> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated.");
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionPayload> {
  const user = await requireUser();
  if (!can(user.role, permission)) throw new Error("Forbidden.");
  return user;
}