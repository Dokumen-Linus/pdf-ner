import { CSSProperties, HTMLAttributes, useEffect, useMemo, useState } from "react"
import { useDocumentState } from "@embedpdf/core/react"
import { useTilingCapability } from "../hooks/use-tiling"
import { Tile, TilingEvent } from "../lib"
import { TileImg } from "./tile-img"

type TilingLayoutProps = Omit<HTMLAttributes<HTMLDivElement>, "style"> & {
  documentId: string
  pageIndex: number
  scale?: number
  style?: CSSProperties
}

export function TilingLayer({
  documentId,
  pageIndex,
  scale: scaleOverride,
  style,
  ...props
}: TilingLayoutProps) {
  const { provides: tilingProvides } = useTilingCapability()
  const documentState = useDocumentState(documentId)
  const [tiles, setTiles] = useState<Tile[]>([])

  useEffect(() => {
    if (tilingProvides) {
      return tilingProvides.onTileRendering((event: TilingEvent) => {
        if (event.documentId === documentId) {
          setTiles(event.tiles[pageIndex] ?? [])
        }
      })
    }
  }, [tilingProvides, documentId, pageIndex])

  const actualScale = useMemo(() => {
    if (scaleOverride !== undefined) return scaleOverride
    return documentState?.scale ?? 1
  }, [scaleOverride, documentState?.scale])

  return (
    <div
      style={{
        ...style,
      }}
      {...props}
    >
      {tiles?.map((tile) => (
        <TileImg
          key={tile.id}
          documentId={documentId}
          pageIndex={pageIndex}
          tile={tile}
          dpr={window.devicePixelRatio}
          scale={actualScale}
        />
      ))}
    </div>
  )
}
