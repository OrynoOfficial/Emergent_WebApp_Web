// Single modal-card strip for a management subpage's chrome.
//
// Renders: [icon] [Name] [count badge] · {children}
//
// Usage (Cinema → Films subpage):
//   <SubpageCard title="Films" icon={Film} count={films.length} testId="cinema-films-subpage">
//     <SearchInput ... /> <CategoryFilter ... /> <ViewModeToggle ... />
//     <Button>Add Film</Button>
//   </SubpageCard>
import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function SubpageCard({
  title,
  icon: Icon,
  iconColorClass = 'text-[#082c59]',
  count,
  testId,
  className = '',
  children,
}) {
  return (
    <Card className={`border-slate-200 shadow-sm ${className}`} data-testid={testId}>
      <div className="px-4 py-2.5 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 pr-2 mr-1 border-r border-slate-200">
          {Icon && <Icon className={`h-4 w-4 ${iconColorClass}`} />}
          <h2 className="text-sm font-semibold text-[#082c59]">{title}</h2>
          {count != null && (
            <Badge variant="outline" className="text-[10px] border-slate-300 text-slate-600 px-1.5 py-0">{count}</Badge>
          )}
        </div>
        {children}
      </div>
    </Card>
  );
}
