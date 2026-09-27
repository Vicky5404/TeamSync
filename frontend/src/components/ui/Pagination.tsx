import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/cn';
import type { PaginationMeta } from '@/types';
import { formatNumber } from '@/utils/format';

import { Button } from './Button';

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ meta, onPageChange, className }: PaginationProps) {
  if (meta.total === 0) return null;
  const from = (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.total, meta.page * meta.pageSize);

  return (
    <nav
      aria-label="Pagination"
      className={cn('flex items-center justify-between gap-3 text-sm', className)}
    >
      <p className="text-muted-foreground">
        <span className="font-medium text-foreground">
          {formatNumber(from)}–{formatNumber(to)}
        </span>{' '}
        of {formatNumber(meta.total)}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(meta.page - 1)}
          disabled={meta.page <= 1}
          leftIcon={<ChevronLeft />}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(meta.page + 1)}
          disabled={meta.page >= meta.totalPages}
          rightIcon={<ChevronRight />}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
