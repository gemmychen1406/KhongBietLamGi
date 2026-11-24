import { createContext, useContext } from "react";
import type { Contribution } from "../types";
export interface Permissions {
  userId: string | null;
  admin: boolean;
  community: boolean;
}
export const PermissionContext = createContext<Permissions>({
  userId: null,
  admin: false,
  community: true,
});
export const usePermissions = () => useContext(PermissionContext);
export function canEdit(p: Permissions, item: Contribution) {
  return (
    !p.community ||
    Boolean(
      p.userId && (p.admin || !item.createdBy || item.createdBy === p.userId),
    )
  );
}
