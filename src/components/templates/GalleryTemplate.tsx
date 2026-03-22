interface GalleryTemplateProps {
  children: React.ReactNode
  title?: string
  actions?: React.ReactNode
}

export function GalleryTemplate({ children, title, actions }: GalleryTemplateProps) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {(title || actions) && (
        <div className="flex items-center justify-between mb-6">
          {title && <h1 className="text-body-md font-semibold">{title}</h1>}
          {actions && <div>{actions}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
