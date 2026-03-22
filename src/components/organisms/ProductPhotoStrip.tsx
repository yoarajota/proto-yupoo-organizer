'use client'

import { useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { PhotoThumb } from '@/components/atoms/PhotoThumb'

interface ProductPhotoStripProps {
  photos: Array<{ id: string; storage_path: string; alt_text: string }>
  supabaseUrl: string
}

export function ProductPhotoStrip({ photos, supabaseUrl }: ProductPhotoStripProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  if (photos.length === 0) {
    return <p className="text-body-sm text-muted-foreground">No photos yet.</p>
  }

  return (
    <>
      <div className="flex gap-2 overflow-x-auto py-1">
        {photos.map((photo, i) => (
          <PhotoThumb
            key={photo.id}
            src={`${supabaseUrl}/storage/v1/object/public/product-photos/${photo.storage_path}`}
            alt={photo.alt_text || `Product photo ${i + 1}`}
            size="lg"
            className="shrink-0 cursor-pointer"
            onClick={() => setSelectedIndex(i)}
          />
        ))}
      </div>

      <Dialog.Root
        open={selectedIndex !== null}
        onOpenChange={(open) => { if (!open) setSelectedIndex(null) }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/80" />
          <Dialog.Popup className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {selectedIndex !== null && (
              <div className="relative flex flex-col items-center gap-4 max-w-3xl w-full">
                <img
                  src={`${supabaseUrl}/storage/v1/object/public/product-photos/${photos[selectedIndex].storage_path}`}
                  alt={photos[selectedIndex].alt_text || `Photo ${selectedIndex + 1}`}
                  className="max-h-[80vh] max-w-full object-contain rounded-lg"
                />
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setSelectedIndex((i) => (i! > 0 ? i! - 1 : photos.length - 1))}
                    className="text-body-sm text-white bg-white/20 hover:bg-white/30 px-3 py-1 rounded-md"
                    aria-label="Previous photo"
                  >
                    ←
                  </button>
                  <span className="text-label-sm text-white">
                    {selectedIndex + 1} / {photos.length}
                  </span>
                  <button
                    onClick={() => setSelectedIndex((i) => (i! < photos.length - 1 ? i! + 1 : 0))}
                    className="text-body-sm text-white bg-white/20 hover:bg-white/30 px-3 py-1 rounded-md"
                    aria-label="Next photo"
                  >
                    →
                  </button>
                </div>
                <Dialog.Close
                  className="absolute top-0 right-0 text-white bg-black/50 hover:bg-black/70 px-2 py-1 rounded-md text-label-sm"
                  aria-label="Close lightbox"
                >
                  ✕
                </Dialog.Close>
              </div>
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
