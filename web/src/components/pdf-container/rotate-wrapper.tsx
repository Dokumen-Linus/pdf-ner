import { CSSProperties, HTMLAttributes, ReactNode } from "react"

import { Rotate } from "./plugin-rotate-2"

type RotateWrapperProps = Omit<HTMLAttributes<HTMLDivElement>, "style"> & {
  enabled: boolean
  children: ReactNode
  documentId: string
  pageIndex: number
  style?: CSSProperties
}

const RotateWrapper = ({ enabled, children, documentId, pageIndex, style }: RotateWrapperProps) => {
  if (!enabled) {
    return <>{children}</>
  }

  return (
    <Rotate documentId={documentId} pageIndex={pageIndex} style={style}>
      {children}
    </Rotate>
  )
}
export default RotateWrapper
