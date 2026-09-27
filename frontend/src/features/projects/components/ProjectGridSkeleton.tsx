import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton';

export function ProjectGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <SkeletonGroup label="Loading projects" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="space-y-4 rounded-xl border bg-surface p-5">
          <div className="flex justify-between">
            <div className="space-y-2">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-5 w-40" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-1.5 w-full rounded-full" />
          <div className="flex justify-between border-t pt-4">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      ))}
    </SkeletonGroup>
  );
}
