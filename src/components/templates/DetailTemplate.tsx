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
    <div className="mx-auto max-w-7xl">
      <header className="mb-8 border-b border-border/70 pb-5">
        <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {breadcrumb}
        </div>
        <h1 className="text-2xl font-heading tracking-tight text-foreground md:text-3xl">
          {title}
        </h1>
      </header>

      <div className={cn(
        "grid grid-cols-1 gap-8",
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
