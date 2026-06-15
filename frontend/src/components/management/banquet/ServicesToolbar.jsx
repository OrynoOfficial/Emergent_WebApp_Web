// Banquet — Services-tab toolbar (extracted from BanquetManagement.jsx).
//
// Single modal-card strip housing the subpage name + local search +
// category filter + view-mode toggle + Add Service button. Stateless;
// parent owns search/categoryFilter/viewMode.
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Layers } from 'lucide-react';
import PermissionGate from '@/components/common/PermissionGate';
import ViewModeToggle from '@/components/common/ViewModeToggle';

export default function ServicesToolbar({
  count,
  search, onSearch,
  categoryFilter, onCategoryChange,
  viewMode, onViewModeChange,
  categories,
  onAdd,
}) {
  return (
    <Card className="border-slate-200 shadow-sm" data-testid="bq-mgmt-subpage-card-services">
      <div className="px-4 py-2.5 flex items-center gap-2 flex-wrap" data-testid="bq-mgmt-toolbar">
        <div className="flex items-center gap-1.5 pr-2 mr-1 border-r border-slate-200">
          <Layers className="h-4 w-4 text-[#082c59]" />
          <h2 className="text-sm font-semibold text-[#082c59]">Services</h2>
          <Badge variant="outline" className="text-[10px] border-slate-300 text-slate-600 px-1.5 py-0">{count}</Badge>
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Search by name, city, address…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="pl-9 h-8 bg-white text-sm"
            data-testid="services-search-input"
          />
        </div>
        <Select value={categoryFilter} onValueChange={onCategoryChange}>
          <SelectTrigger className="w-40 h-8 bg-white text-sm" data-testid="category-filter-select">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map(c => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
          </SelectContent>
        </Select>
        <ViewModeToggle value={viewMode} onChange={onViewModeChange} />
        <PermissionGate permission="banquets.create">
          <Button onClick={onAdd} className="bg-[#082c59] h-8" size="sm" data-testid="add-service-btn">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Service
          </Button>
        </PermissionGate>
      </div>
    </Card>
  );
}
