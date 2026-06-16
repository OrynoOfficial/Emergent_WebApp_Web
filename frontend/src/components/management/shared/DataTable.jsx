import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search, Filter, ChevronLeft, ChevronRight, ArrowUpDown,
  Grid3X3, List, Rows3, RefreshCw, Download, Plus, MoreVertical
} from 'lucide-react';
import ViewModeToggle from '@/components/common/ViewModeToggle';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';

/**
 * SearchFilter - Search and filter bar component
 */
export function SearchFilter({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters = [],
  onFilterChange,
  filterValues = {},
  showViewToggle = false,
  viewMode = 'list',
  onViewModeChange,
  actions,
  onRefresh,
  className = ''
}) {
  return (
    <div className={`flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between ${className}`}>
      <div className="flex flex-1 gap-3 w-full sm:w-auto">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
        {filters.map(filter => (
          <Select
            key={filter.key}
            value={filterValues[filter.key] || 'all'}
            onValueChange={(v) => onFilterChange(filter.key, v)}
          >
            <SelectTrigger className="w-[140px] bg-white">
              <SelectValue placeholder={filter.placeholder} />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all">{filter.allLabel || 'All'}</SelectItem>
              {filter.options.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
      </div>
      <div className="flex gap-2">
        {showViewToggle && (
          <ViewModeToggle value={viewMode} onChange={onViewModeChange} />
        )}
        {onRefresh && (
          <Button variant="outline" size="icon" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
        {actions}
      </div>
    </div>
  );
}

/**
 * Pagination - Pagination controls
 */
export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  className = ''
}) {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className={`flex items-center justify-between ${className}`}>
      <p className="text-sm text-slate-500">
        Showing {startItem}-{endItem} of {totalItems}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-slate-600 min-w-[80px] text-center">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * EmptyState - Empty state component
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  actionLabel,
  onAction
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {Icon && (
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <Icon className="h-8 w-8 text-slate-400" />
        </div>
      )}
      <h3 className="text-lg font-medium text-slate-700 mb-1">{title}</h3>
      {description && <p className="text-slate-500 text-sm max-w-sm mb-4">{description}</p>}
      {onAction && actionLabel && (
        <Button onClick={onAction} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

/**
 * ActionMenu - Dropdown menu for item actions
 */
export function ActionMenu({ actions, item }) {
  if (!actions || actions.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-white min-w-[140px]">
        {actions.map((action, idx) => {
          if (action.divider) {
            return <DropdownMenuSeparator key={idx} />;
          }
          const Icon = action.icon;
          return (
            <DropdownMenuItem
              key={action.key || idx}
              onClick={() => action.onClick(item)}
              className={action.destructive ? 'text-red-600' : ''}
              disabled={action.disabled}
            >
              {Icon && <Icon className="h-4 w-4 mr-2" />}
              {action.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * StatusBadge - Reusable status badge
 */
export function StatusBadge({ status, statusMap }) {
  const config = statusMap[status] || { label: status, className: 'bg-slate-100 text-slate-700' };
  return (
    <Badge className={`${config.className} font-medium`}>
      {config.label}
    </Badge>
  );
}

export default { SearchFilter, Pagination, EmptyState, ActionMenu, StatusBadge };
