import { cn } from "@/lib/utils";

interface GalleryTemplateProps {
  children: React.ReactNode;
  title?: string;
  actions?: React.ReactNode;
}

export function GalleryTemplate({
  children,
  title,
  actions,
}: GalleryTemplateProps) {
  return (
    <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in duration-1000">
      {(title || actions) && (
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-foreground/5 pb-8">
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
              Collection
            </div>
            {title && (
              <h1 className="text-4xl md:text-5xl font-heading tracking-tight text-foreground">
                {title}
              </h1>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-4">{actions}</div>
          )}
        </header>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-12">
        {children}
      </div>
    </div>
  );
}
