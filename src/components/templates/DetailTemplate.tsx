interface DetailTemplateProps {
  breadcrumb: React.ReactNode
  title: string
  children: React.ReactNode
  sideContent?: React.ReactNode
}

export function DetailTemplate({ breadcrumb, title, children, sideContent }: DetailTemplateProps) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-1 text-body-sm text-muted-foreground">{breadcrumb}</div>
      <h1 className="text-body-md font-semibold mb-6">{title}</h1>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div>{children}</div>
        {sideContent && <div>{sideContent}</div>}
      </div>
    </div>
  )
}
