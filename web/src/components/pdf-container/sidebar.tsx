import { useScroll } from "./plugin-scroll-2"
import { ThumbImg, ThumbnailsPane } from "./plugin-thumbnail-2"

import "./sidebar.css"

interface SidebarProps {
  documentId: string
}

export default function Sidebar({ documentId }: SidebarProps) {
  const { state, provides: scrollCapability } = useScroll(documentId)

  return (
    <aside className="pdf-sidebar">
      <ThumbnailsPane documentId={documentId} className="h-full" style={{ paddingInline: 8 }}>
        {(meta) => {
          const isActive = state.currentPage === meta.pageIndex + 1

          return (
            <button
              key={meta.pageIndex}
              type="button"
              style={{
                height: meta.wrapperHeight,
                top: meta.top,
              }}
              onClick={() => {
                scrollCapability?.scrollToPage({
                  pageNumber: meta.pageIndex + 1,
                })
              }}
            >
              <div
                className={`frame ${isActive ? "active" : "idle"}`}
                style={{
                  width: meta.width,
                  height: meta.height,
                }}
              >
                <ThumbImg
                  documentId={documentId}
                  meta={meta}
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="label" style={{ height: meta.labelHeight }}>
                <span className={isActive ? "active" : ""}>{meta.pageIndex + 1}</span>
              </div>
            </button>
          )
        }}
      </ThumbnailsPane>
    </aside>
  )
}
