import { createContext, RefObject } from "react"

/**
 * Context to share the viewport DOM element reference with child components.
 * This allows child components (like ZoomGestureWrapper) to access the viewport
 * container element without DOM traversal.
 */
export const ViewportElementContext = createContext<RefObject<HTMLDivElement> | null>(null)
