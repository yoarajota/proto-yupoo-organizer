import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { SourceRow, type SourceWithProfile } from "@/components/organisms/SourceRow";
import { Button } from "@/components/ui/button";

interface SourcesTableProps {
  sources: SourceWithProfile[];
  onClearFilters?: () => void;
  isFiltered?: boolean;
}

export function SourcesTable({ sources, onClearFilters, isFiltered }: SourcesTableProps) {
  if (sources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border rounded-xl bg-surface-container-low gap-4 text-center">
        <p className="text-body-sm text-muted-foreground">
          {isFiltered ? "No results for selected filters." : "No sources added yet."}
        </p>
        {isFiltered ? (
          <Button variant="link" onClick={onClearFilters}>
            Clear filters
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface-container-low overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-b-2 border-foreground/10 hover:bg-transparent">
            <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground py-6">Platform</TableHead>
            <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground py-6">Source / URL</TableHead>
            <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground py-6">Annotations</TableHead>
            <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground py-6">Originator</TableHead>
            <TableHead className="text-right text-[10px] uppercase tracking-widest text-muted-foreground py-6 pr-6">Activity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sources.map((source) => (
            <SourceRow key={source.id} source={source} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
