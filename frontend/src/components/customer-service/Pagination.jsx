import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Pagination Component
export const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;
  
  const maxVisible = 5;
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="h-9 w-9 p-0">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {start > 1 && (
        <>
          <Button variant="ghost" size="sm" onClick={() => onPageChange(1)} className="h-9 w-9 p-0">1</Button>
          {start > 2 && <span className="px-1 text-slate-400">...</span>}
        </>
      )}
      {pages.map(page => (
        <Button 
          key={page} 
          variant={currentPage === page ? 'default' : 'ghost'} 
          size="sm" 
          onClick={() => onPageChange(page)} 
          className={`h-9 w-9 p-0 ${currentPage === page ? 'bg-[#082c59]' : ''}`}
        >
          {page}
        </Button>
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="px-1 text-slate-400">...</span>}
          <Button variant="ghost" size="sm" onClick={() => onPageChange(totalPages)} className="h-9 w-9 p-0">{totalPages}</Button>
        </>
      )}
      <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="h-9 w-9 p-0">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default Pagination;
