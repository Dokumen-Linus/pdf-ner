import { Link } from "@tanstack/react-router"
import {
  BrainCircuitIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  PencilIcon,
  ShieldCheckIcon,
  TagIcon,
  type LucideIcon,
} from "lucide-react"
import { Badge } from "@/components/shadcn-ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/shadcn-ui/tooltip"
import { cn } from "@/lib/shadcn-ui/utils"

export type ProjectStepKey =
  | "documents"
  | "entity_types"
  | "labelling"
  | "engineering"
  | "checking"
  | "dashboard"

// Narrow union so the generated TanStack Router Link accepts `to` directly.
type ProjectStepPath =
  | "/projects/$projectId/documents"
  | "/projects/$projectId/entity_types"
  | "/projects/$projectId/labelling"
  | "/projects/$projectId/engineering"
  | "/projects/$projectId/checking"
  | "/projects/$projectId/dashboard"

type ProjectStep = {
  n: number
  key: ProjectStepKey
  label: string
  to: ProjectStepPath | null
  icon: LucideIcon
  disabled?: boolean
}

// Single source of truth for the sequential project workflow.
// Order here defines the rendered order everywhere.
export const PROJECT_STEPS: readonly ProjectStep[] = [
  {
    n: 1,
    key: "documents",
    label: "Documents",
    to: "/projects/$projectId/documents",
    icon: FileTextIcon,
  },
  {
    n: 2,
    key: "entity_types",
    label: "Entity Types",
    to: "/projects/$projectId/entity_types",
    icon: TagIcon,
  },
  {
    n: 3,
    key: "labelling",
    label: "Labelling",
    to: "/projects/$projectId/labelling",
    icon: PencilIcon,
  },
  {
    n: 4,
    key: "engineering",
    label: "Engineering",
    to: "/projects/$projectId/engineering",
    icon: BrainCircuitIcon,
  },
  {
    n: 5,
    key: "checking",
    label: "Checking",
    to: "/projects/$projectId/checking",
    icon: ShieldCheckIcon,
  },
  {
    n: 6,
    key: "dashboard",
    label: "Dashboard",
    to: "/projects/$projectId/dashboard",
    icon: LayoutDashboardIcon,
  },
] as const

type ProjectTabsProps = {
  projectId: string
  // null = wizard hub itself (no step is active).
  currentStep: ProjectStepKey | null
  variant?: "tabs" | "compact"
}

export function ProjectTabs({ projectId, currentStep, variant = "tabs" }: ProjectTabsProps) {
  const compact = variant === "compact"
  return (
    <TooltipProvider>
      <nav
        aria-label="Project steps"
        className={cn(
          "flex items-center gap-1 overflow-x-auto border-b pb-px",
          compact ? "min-w-0" : "min-w-0",
        )}
      >
        {PROJECT_STEPS.map((step) => (
          <ProjectTabItem
            key={step.key}
            step={step}
            projectId={projectId}
            active={currentStep === step.key}
            compact={compact}
          />
        ))}
      </nav>
    </TooltipProvider>
  )
}

function ProjectTabItem({
  step,
  projectId,
  active,
  compact,
}: {
  step: ProjectStep
  projectId: string
  active: boolean
  compact: boolean
}) {
  const Icon = step.icon
  const padding = compact ? "px-2.5 py-1.5" : "px-4 py-2.5"
  const gap = compact ? "gap-1.5" : "gap-2"
  const iconSize = compact ? "h-3.5 w-3.5" : "h-4 w-4"
  const numberSize = compact ? "h-4 w-4 text-[10px]" : "h-5 w-5 text-[11px]"
  const labelSize = compact ? "text-xs" : "text-sm"

  const baseClasses = cn(
    "inline-flex items-center whitespace-nowrap rounded-t-lg border-b-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    padding,
    gap,
    labelSize,
  )

  const activeClasses = "border-primary bg-muted/40 text-foreground"
  const idleClasses =
    "border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground"
  const disabledClasses = "border-transparent text-muted-foreground/60 cursor-not-allowed"

  const numberBadge = (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex items-center justify-center rounded-full tabular-nums font-semibold",
        numberSize,
        active
          ? "bg-primary text-primary-foreground"
          : step.disabled
            ? "bg-muted text-muted-foreground/70"
            : "bg-muted text-muted-foreground",
      )}
    >
      {step.n}
    </span>
  )

  if (step.disabled || step.to === null) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span role="link" aria-disabled="true" className={cn(baseClasses, disabledClasses)}>
            {numberBadge}
            <Icon aria-hidden="true" className={iconSize} />
            <span>{step.label}</span>
            {!compact && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] font-normal">
                Coming soon
              </Badge>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">Coming soon</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Link
      to={step.to}
      params={{ projectId }}
      aria-current={active ? "page" : undefined}
      className={cn(baseClasses, active ? activeClasses : idleClasses)}
    >
      {numberBadge}
      <Icon aria-hidden="true" className={cn(iconSize, active && "text-primary")} />
      <span>{step.label}</span>
    </Link>
  )
}
