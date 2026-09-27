import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/cn';
import type { SortOrder } from '@/types';

interface TableProps extends ComponentProps<'table'> {
  containerClassName?: string;
}

/** Responsive table: scrolls horizontally inside its container on small screens. */
export function Table({ className, containerClassName, ...props }: TableProps) {
  return (
    <div
      className={cn(
        'relative w-full scrollbar-thin overflow-x-auto rounded-xl border bg-surface',
        containerClassName,
      )}
    >
      <table
        className={cn('w-full caption-bottom border-collapse text-sm', className)}
        {...props}
      />
    </div>
  );
}

export function TableHeader({ className, ...props }: ComponentProps<'thead'>) {
  return <thead className={cn('bg-surface-muted/60 [&_tr]:border-b', className)} {...props} />;
}

export function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

export function TableRow({ className, ...props }: ComponentProps<'tr'>) {
  return (
    <tr
      className={cn(
        'border-b transition-colors hover:bg-accent/60 data-[selected=true]:bg-accent',
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th
      scope="col"
      className={cn(
        'h-10 px-3 text-left align-middle text-xs font-medium whitespace-nowrap text-muted-foreground first:pl-4 last:pr-4',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: ComponentProps<'td'>) {
  return (
    <td className={cn('px-3 py-2.5 align-middle first:pl-4 last:pr-4', className)} {...props} />
  );
}

interface SortableTableHeadProps extends Omit<ComponentProps<'th'>, 'onClick'> {
  active: boolean;
  order: SortOrder;
  onSort: () => void;
  children: ReactNode;
}

/** Column header that toggles sorting and exposes `aria-sort`. */
export function SortableTableHead({
  active,
  order,
  onSort,
  children,
  className,
  ...props
}: SortableTableHeadProps) {
  const Icon = !active ? ArrowUpDown : order === 'asc' ? ArrowUp : ArrowDown;
  return (
    <TableHead
      aria-sort={active ? (order === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={className}
      {...props}
    >
      <button
        type="button"
        onClick={onSort}
        className="-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground"
      >
        {children}
        <Icon aria-hidden="true" className={cn('size-3.5', !active && 'opacity-50')} />
      </button>
    </TableHead>
  );
}
