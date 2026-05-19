'use client'

import { useState } from 'react'
import { Camera } from 'lucide-react'

interface PhotoThumbProps {
  src: string
  alt: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
  onClick?: () => void
}

const sizeClasses = {
  sm: 'w-thumb-sm h-thumb-sm',
  md: 'w-thumb-md h-thumb-md',
  lg: 'w-32 h-32',
}

export function PhotoThumb({ src, alt, size = 'md', className, onClick }: PhotoThumbProps) {
  const [error, setError] = useState(false)

  return (
    <div
      className={`relative overflow-hidden rounded min-w-[44px] min-h-[44px] ${sizeClasses[size]} ${className ?? ''}`}
      onClick={onClick}
    >
      {error || !src ? (
        <div className="w-full h-full bg-surface-container-low flex items-center justify-center">
          <Camera className="text-muted-foreground" size={20} />
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          className="object-cover w-full h-full"
          onError={() => setError(true)}
        />
      )}
    </div>
  )
}
