import { DEFAULT_PERMISSION_MODE } from "@yep-anywhere/shared";
import type { PermissionMode } from "../types";

export const VISIBLE_PERMISSION_MODES: PermissionMode[] = [
  "bypassPermissions",
  "plan",
];

export function normalizeVisiblePermissionMode(
  mode: PermissionMode | undefined | null,
): PermissionMode {
  return mode === "plan" ? "plan" : DEFAULT_PERMISSION_MODE;
}
