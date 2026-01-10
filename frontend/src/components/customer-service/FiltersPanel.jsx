import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { X, SlidersHorizontal, RefreshCw } from 'lucide-react';
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES, USER_TYPES } from './constants';

export const FiltersPanel = ({ 
  filters, 
  setFilters, 
  teamMembers, 
  onClose, 
  onReset 
}) => {
  return (
    <Card className="mb-4 border-2 border-dashed border-slate-200">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4" />
            Advanced Filters
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onReset}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Reset
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Status</Label>
            <Select value={filters.status} onValueChange={(v) => setFilters(prev => ({ ...prev, status: v }))}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Any status" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="">Any status</SelectItem>
                {TICKET_STATUSES.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Priority</Label>
            <Select value={filters.priority} onValueChange={(v) => setFilters(prev => ({ ...prev, priority: v }))}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Any priority" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="">Any priority</SelectItem>
                {TICKET_PRIORITIES.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Category</Label>
            <Select value={filters.category} onValueChange={(v) => setFilters(prev => ({ ...prev, category: v }))}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Any category" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="">Any category</SelectItem>
                {TICKET_CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">User Type</Label>
            <Select value={filters.user_type} onValueChange={(v) => setFilters(prev => ({ ...prev, user_type: v }))}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Any user" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="">Any user type</SelectItem>
                {USER_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Assigned To</Label>
            <Select value={filters.assigned_to} onValueChange={(v) => setFilters(prev => ({ ...prev, assigned_to: v }))}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Anyone" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="">Anyone</SelectItem>
                {teamMembers.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer h-9 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
              <Checkbox 
                checked={filters.unassigned}
                onCheckedChange={(checked) => setFilters(prev => ({ ...prev, unassigned: checked }))}
              />
              <span className="text-sm">Unassigned only</span>
            </label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
