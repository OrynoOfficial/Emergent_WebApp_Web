import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Reusable pagination footer used across list/table screens.
 *
 * Props:
 *   page             — 1-based current page
 *   totalPages       — total page count
 *   onChange(p)      — called with new 1-based page index
 *   total            — optional, total item count for the "Showing X of Y" label
 *   pageSize         — optional, items per page for the "Showing X of Y" label
 *   itemLabel        — singular label, default "item"
 *   className        — wrapper class override
 *   compact          — compact variant without the outer Card wrapper (for use inside dialogs)
 */
export default function Pagination({
  page,
  totalPages,
  onChange,
  total = null,
  pageSize = null,
  itemLabel = 'item',
  className = '',
  compact = false,
}) {
  if (!totalPages || totalPages <= 1) return null;

  const goto = (p) => onChange(Math.min(Math.max(1, p), totalPages));

  const buildWindow = () => {
    const out = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) out.push(i);
    } else if (page <= 3) {
      for (let i = 1; i <= 5; i++) out.push(i);
    } else if (page >= totalPages - 2) {
      for (let i = totalPages - 4; i <= totalPages; i++) out.push(i);
    } else {
      for (let i = page - 2; i <= page + 2; i++) out.push(i);
    }
    return out;
  };

  const summary = (() => {
    if (total !== null && pageSize !== null) {
      const start = (page - 1) * pageSize + 1;
      const end = Math.min(page * pageSize, total);
      return `Showing ${start}-${end} of ${total} ${itemLabel}${total !== 1 ? 's' : ''}`;
    }
    return `Page ${page} of ${totalPages}`;
  })();

  const inner = (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
      <p className="text-sm text-slate-500" data-testid="pagination-summary">{summary}</p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => goto(page - 1)}
          disabled={page === 1}
          className="border-slate-200"
          data-testid="pagination-prev"
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Previous
        </Button>
        <div className="hidden sm:flex items-center gap-1">
          {buildWindow().map((n) => (
            <Button
              key={n}
              variant={page === n ? 'default' : 'outline'}
              size="sm"
              onClick={() => goto(n)}
              className={page === n ? 'bg-[#082c59] hover:bg-[#0a3a75]' : 'border-slate-200'}
              data-testid={`pagination-page-${n}`}
            >
              {n}
            </Button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => goto(page + 1)}
          disabled={page === totalPages}
          className="border-slate-200"
          data-testid="pagination-next"
        >
          Next <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );

  if (compact) {
    return <div className={`px-2 py-3 ${className}`} data-testid="pagination">{inner}</div>;
  }
  return (
    <Card className={`border-slate-200 ${className}`} data-testid="pagination">
      <CardContent className="p-4">{inner}</CardContent>
    </Card>
  );
}
