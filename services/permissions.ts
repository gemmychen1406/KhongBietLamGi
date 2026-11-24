import { createContext, useContext } from "react";
import type { Contribution } from "../types";
export interface Permissions {
  userId: string | null;
  admin: boolean;
  community: boolean;
  readOnly?: boolean;
  librarySource?: "sample" | "community";
}
export const PermissionContext = createContext<Permissions>({
  userId: null,
  admin: false,
  community: true,
});
export const usePermissions = () => useContext(PermissionContext);
export function canContribute(p: Permissions) {
  return !p.readOnly && (!p.community || Boolean(p.userId));
}
export function canEdit(p: Permissions, item: Contribution) {
  return (
    canContribute(p) &&
    (!p.community ||
      p.admin ||
      (!item.systemSeedKey && (!item.createdBy || item.createdBy === p.userId)))
  );
}
