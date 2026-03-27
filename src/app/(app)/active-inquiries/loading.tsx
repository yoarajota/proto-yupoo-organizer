import { DetailTemplate } from "@/components/templates/DetailTemplate"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function Loading() {
  return (
    <DetailTemplate 
      title="Active Inquiries"
      breadcrumb={<span>Home</span>}
    >
      <div className="space-y-6">
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="h-[48px] bg-muted/50">
                <TableHead className="w-[180px] text-label-md">Product</TableHead>
                <TableHead className="w-[200px] text-label-md">Supplier</TableHead>
                <TableHead className="w-[160px] text-label-md">Status</TableHead>
                <TableHead className="w-[100px] text-label-md">Best Price</TableHead>
                <TableHead className="text-label-md">Notes</TableHead>
                <TableHead className="text-right text-label-md">Activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="h-[72px]">
                  <TableCell className="pt-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-md" />
                      <Skeleton className="h-4 w-[120px]" />
                    </div>
                  </TableCell>
                  <TableCell className="pt-4"><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell className="pt-3"><Skeleton className="h-8 w-[120px]" /></TableCell>
                  <TableCell className="pt-4"><Skeleton className="h-4 w-[60px]" /></TableCell>
                  <TableCell className="pt-4"><Skeleton className="h-4 w-[150px]" /></TableCell>
                  <TableCell className="pt-4 text-right">
                    <div className="flex justify-end">
                      <Skeleton className="h-4 w-[80px]" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </DetailTemplate>
  )
}
