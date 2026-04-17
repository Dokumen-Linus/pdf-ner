import { useScroll } from "./plugin-scroll-2"
import { ThumbnailsPane, ThumbImg } from "./plugin-thumbnail-2"

interface SidebarProps {
  documentId: string
}

export default function Sidebar({ documentId }: SidebarProps) {
  const { state, provides: scrollCapability } = useScroll(documentId)

  return (
    <aside className="h-full w-[172px] shrink-0 border-r border-gray-200 bg-gray-50">
      <ThumbnailsPane documentId={documentId} className="h-full" style={{ paddingInline: 8 }}>
        {(meta) => {
          const isActive = state.currentPage === meta.pageIndex + 1

          return (
            <button
              key={meta.pageIndex}
              type="button"
              className="absolute flex w-full cursor-pointer flex-col items-center px-2 text-left"
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
                className={`overflow-hidden rounded-md border-2 transition-all ${
                  isActive
                    ? "border-blue-500 shadow-sm"
                    : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                }`}
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
              <div
                className="mt-1 flex items-center justify-center text-xs font-medium"
                style={{ height: meta.labelHeight }}
              >
                <span className={isActive ? "text-blue-600" : "text-gray-500"}>
                  {meta.pageIndex + 1}
                </span>
              </div>
            </button>
          )
        }}
      </ThumbnailsPane>
    </aside>
  )
}
