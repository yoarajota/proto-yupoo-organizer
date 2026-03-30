interface DetailTemplateProps {
  breadcrumb: React.ReactNode;
  title: string;
  children: React.ReactNode;
  sideContent?: React.ReactNode;
}

export function DetailTemplate({
  breadcrumb,
  title,
  children,
  sideContent,
}: DetailTemplateProps) {
  return (
    <div className="max-w-7xl mx-auto">
      <header className="mb-12">
        <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
          {breadcrumb}
        </div>
        <h1 className="text-4xl md:text-5xl font-heading tracking-tight text-foreground">
          {title}
        </h1>
      </header>

      <div className={cn(
        "grid grid-cols-1 gap-12",
        sideContent ? "lg:grid-cols-[1fr_380px]" : "lg:grid-cols-1"
      )}>
        <section className="space-y-8">{children}</section>
        {sideContent && (
          <aside className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-1000 delay-300">
            {sideContent}
          </aside>
        )}
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";
