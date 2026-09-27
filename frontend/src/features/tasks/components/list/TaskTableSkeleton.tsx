import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton';

export function TaskTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <SkeletonGroup label="Loading tasks" className="overflow-hidden rounded-xl border bg-surface">
      <div className="border-b bg-surface-muted/60 px-4 py-3">
        <Skeleton className="h-3 w-1/3" />
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-4 px-4 py-3.5">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="hidden h-5 w-20 rounded-full md:block" />
            <Skeleton className="hidden h-4 w-16 md:block" />
            <Skeleton className="size-6 rounded-full" />
          </div>
        ))}
      </div>
    </SkeletonGroup>
  );
}
