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
// Editing public content and deleting owned content are deliberately separate permissions.
export function canEdit(p: Permissions, _item?: Contribution) {
  return canContribute(p);
}
export function canDelete(p: Permissions, item: Contribution) {
  return (
    canContribute(p) &&
    (!p.community ||
      p.admin ||
      (!item.systemSeedKey && (!item.createdBy || item.createdBy === p.userId)))
  );
}
