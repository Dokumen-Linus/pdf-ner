import { Fragment } from "react"

import { MarqueeSelectionStyle, TextSelectionStyle } from "../lib"

import { MarqueeSelection } from "./marquee-selection"
import { TextSelection } from "./text-selection"

type Props = {
  documentId: string
  pageIndex: number
  scale?: number
  /**
   * @deprecated Use `textStyle.background` instead.
   */
  background?: string
  /** Styling options for text selection highlights */
  textStyle?: TextSelectionStyle
  /** Styling options for the marquee selection rectangle */
  marqueeStyle?: MarqueeSelectionStyle
  /** Optional CSS class applied to the marquee rectangle */
  marqueeClassName?: string
}

/**
 * SelectionLayer is a convenience component that composes both text selection
 * and marquee selection on a single page.
 *
 * For advanced use cases, you can use `TextSelection` and `MarqueeSelection`
 * individually.
 */
export function SelectionLayer({
  documentId,
  pageIndex,
  scale,
  background,
  textStyle,
  marqueeStyle,
  marqueeClassName,
}: Props) {
  return (
    <Fragment>
      <TextSelection
        documentId={documentId}
        pageIndex={pageIndex}
        scale={scale}
        background={textStyle?.background ?? background}
      />
      <MarqueeSelection
        documentId={documentId}
        pageIndex={pageIndex}
        scale={scale}
        background={marqueeStyle?.background}
        borderColor={marqueeStyle?.borderColor}
        borderStyle={marqueeStyle?.borderStyle}
        className={marqueeClassName}
      />
    </Fragment>
  )
}
