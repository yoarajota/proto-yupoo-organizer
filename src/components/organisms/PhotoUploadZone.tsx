'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, CheckCircle, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createProduct, addProductPhoto } from '@/actions/products'

type FileStatus = 'uploading' | 'done' | 'error'

interface FileState {
  name: string
  progress: number
  status: FileStatus
  error?: string
}

interface PhotoUploadZoneProps {
  onUploadComplete?: () => void
  productId?: string   // if present → append to existing product via addProductPhoto
}

export function PhotoUploadZone({ onUploadComplete, productId }: PhotoUploadZoneProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileStates, setFileStates] = useState<Map<string, FileState>>(new Map())
  const [isDragOver, setIsDragOver] = useState(false)

  function updateFile(fileId: string, update: Partial<FileState>) {
    setFileStates(prev => {
      const next = new Map(prev)
      const entry = next.get(fileId)
      if (entry) next.set(fileId, { ...entry, ...update })
      return next
    })
  }

  async function uploadFile(file: File) {
    const fileId = crypto.randomUUID()
    const storagePath = `products/${fileId}-${file.name}`

    setFileStates(prev => {
      const next = new Map(prev)
      next.set(fileId, { name: file.name, progress: 0, status: 'uploading' })
      return next
    })

    const supabase = createClient()
    const { error: storageError } = await supabase.storage
      .from('product-photos')
      .upload(storagePath, file, { upsert: false })

    updateFile(fileId, { progress: 100 })

    if (storageError) {
      updateFile(fileId, { status: 'error', error: storageError.message })
      return
    }

    const result = productId
      ? await addProductPhoto(productId, storagePath, file.name)
      : await createProduct(storagePath, file.name)
    if (result.error) {
      updateFile(fileId, { status: 'error', error: result.error.message })
      return
    }

    updateFile(fileId, { status: 'done', progress: 100 })
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return

    const uploads = Array.from(files).map(uploadFile)
    await Promise.all(uploads)

    onUploadComplete?.()
    router.refresh()
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  const fileEntries = Array.from(fileStates.entries())

  return (
    <div>
      <div
        className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${
          isDragOver
            ? 'border-primary bg-surface-container-low'
            : 'border-border hover:border-primary hover:bg-surface-container-low'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="text-muted-foreground mb-2" size={24} />
        <p className="text-body-sm text-muted-foreground text-center">
          Drop photos here or click to select
        </p>
      </div>

      <input
        type="file"
        multiple
        accept="image/*"
        ref={inputRef}
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />

      {fileEntries.length > 0 && (
        <div className="mt-3 space-y-2">
          {fileEntries.map(([fileId, state]) => (
            <div key={fileId} className="flex items-center gap-2">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-label-sm text-foreground truncate max-w-[200px]">{state.name}</span>
                  {state.status === 'done' && <CheckCircle size={14} className="text-primary shrink-0" />}
                  {state.status === 'error' && <AlertCircle size={14} className="text-error shrink-0" />}
                </div>
                {state.status === 'uploading' && (
                  <div className="h-1 bg-surface-container-high rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${state.progress}%` }}
                    />
                  </div>
                )}
                {state.status === 'error' && state.error && (
                  <p className="text-label-xs text-error">{state.error}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
