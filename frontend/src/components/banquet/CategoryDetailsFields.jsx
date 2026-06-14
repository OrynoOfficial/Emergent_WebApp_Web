// Renders the category-specific rich fields for the "Add Service" modal.
// Walks `CATEGORY_SCHEMA[category]` and renders the right control per
// field type. State lives in the parent form's `category_details` dict.
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { CATEGORY_SCHEMA } from './categorySchema';

export default function CategoryDetailsFields({ category, details, onChange }) {
  const groups = CATEGORY_SCHEMA[category] || [];
  if (groups.length === 0) return null;

  const set = (key, value) => onChange({ ...details, [key]: value });
  const toggleMulti = (key, opt) => {
    const arr = Array.isArray(details?.[key]) ? details[key] : [];
    set(key, arr.includes(opt) ? arr.filter(x => x !== opt) : [...arr, opt]);
  };

  return (
    <div className="col-span-2 space-y-5 border-t pt-5 mt-2">
      {groups.map((group, gi) => (
        <div key={gi} className="space-y-3">
          <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{group.label}</h4>
          <div className="grid grid-cols-2 gap-3">
            {group.fields.map(f => {
              const value = details?.[f.key];
              const testid = `details-${f.key}`;

              if (f.type === 'bool') {
                return (
                  <label key={f.key} className="flex items-center gap-2 text-sm py-2 cursor-pointer col-span-1">
                    <Checkbox
                      checked={!!value}
                      onCheckedChange={(v) => set(f.key, !!v)}
                      data-testid={testid}
                    />
                    <span>{f.label}</span>
                  </label>
                );
              }

              if (f.type === 'select') {
                return (
                  <div key={f.key}>
                    <Label className="text-xs">{f.label}</Label>
                    <Select value={value || ''} onValueChange={(v) => set(f.key, v)}>
                      <SelectTrigger className="mt-1" data-testid={testid}><SelectValue placeholder="Choose…" /></SelectTrigger>
                      <SelectContent>
                        {f.options.map(o => (<SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              }

              if (f.type === 'multi') {
                const arr = Array.isArray(value) ? value : [];
                return (
                  <div key={f.key} className="col-span-2">
                    <Label className="text-xs">{f.label}</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1.5" data-testid={testid}>
                      {f.options.map(o => (
                        <Badge
                          key={o}
                          variant={arr.includes(o) ? 'default' : 'outline'}
                          className="cursor-pointer capitalize"
                          onClick={() => toggleMulti(f.key, o)}
                        >
                          {o}
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              }

              if (f.type === 'textarea') {
                return (
                  <div key={f.key} className="col-span-2">
                    <Label className="text-xs">{f.label}</Label>
                    <Textarea
                      value={value || ''}
                      onChange={(e) => set(f.key, e.target.value)}
                      className="mt-1"
                      rows={2}
                      data-testid={testid}
                    />
                  </div>
                );
              }

              // text / number default
              return (
                <div key={f.key}>
                  <Label className="text-xs">{f.label}</Label>
                  <Input
                    type={f.type === 'number' ? 'number' : 'text'}
                    value={value ?? ''}
                    onChange={(e) => set(f.key, f.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
                    className="mt-1"
                    data-testid={testid}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
