import { requireProjectAccess } from "@/lib/project-authorization.server"

import type { ProjectAccessContext } from "@/lib/project-authorization.server"

export type AppPermission =
  | "billing"
  | "manage_project"
  | "upload_documents"
  | "manage_entity_types"
  | "engineering"
  | "label_documents"
  | "check_documents"
  | "view_outputs"

export function canUsePermission(access: ProjectAccessContext, permission: AppPermission) {
  const isDeveloper = access.subscriptionType === "developer" && access.canManage
  const isAnalyst = access.subscriptionType === "analyst" && access.canLabel

  switch (permission) {
    case "billing":
    case "manage_project":
    case "upload_documents":
    case "manage_entity_types":
    case "engineering":
      return isDeveloper
    case "label_documents":
    case "check_documents":
    case "view_outputs":
      return isDeveloper || isAnalyst
  }
}

export function requirePermission(access: ProjectAccessContext, permission: AppPermission) {
  if (!canUsePermission(access, permission)) {
    throw new Error("Your subscription or role does not allow this action")
  }
  return access
}

export async function requireProjectPermission(projectId: string, permission: AppPermission) {
  const access = await requireProjectAccess(
    projectId,
    permission === "billing" ||
      permission === "manage_project" ||
      permission === "upload_documents" ||
      permission === "manage_entity_types" ||
      permission === "engineering"
      ? "manage"
      : "label",
  )
  return requirePermission(access, permission)
}
