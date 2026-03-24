'use client';

import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@relentify/ui";
import { TableHead } from "@relentify/ui";

type SortDirection = 'asc' | 'desc';

interface SortDescriptor<T> {
  column: T;
  direction: SortDirection;
}

interface SortableTableHeadProps<T> {
  column: T;
  title: string;
  sortDescriptor: SortDescriptor<T>;
  onSort: (column: T) => void;
  className?: string;
}

export function SortableTableHead<T>({ column, title, sortDescriptor, onSort, className }: SortableTableHeadProps<T>) {
  const isSorted = sortDescriptor.column === column;
  return (
    <TableHead className={className}>
      <Button variant="ghost" onClick={() => onSort(column)} className="px-2 py-1 h-auto -ml-2">
        <span>{title}</span>
        {isSorted && (
          sortDescriptor.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
        )}
      </Button>
    </TableHead>
  );
}
