import "server-only";

import { getCurrentUserInfo } from "./current-user";

export async function isCurrentUserAdmin() {
  const current = await getCurrentUserInfo();
  if (!current) return false;
  return (current.role ?? 'USER') === 'ADMIN';
}
