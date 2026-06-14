// Reusable widget: assign sub-categories to an operator. Categories are
// stored as qualified tags (e.g. `banquet.photographer`) inside the
// operator's `service_types` array, alongside top-level areas
// (`banquet`, `restaurant`).
//
// Used by:
//   • OperatorsManagement.jsx — inline section in the Edit Operator modal
//   • OperatorCategoriesPage.jsx — dedicated "Categories" tab
//
// Sub-categories only render for parent areas the operator already has
// enabled (UX rule — keeps the panel uncluttered).
import React, { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  CATEGORY_CATALOG, parseOperatorTags, serializeOperatorTags,
} from './operatorCategoryUtils';

export default function OperatorCategoryAssign({ value = [], onChange, dense = false }) {
  const { areas, cats } = useMemo(() => parseOperatorTags(value), [value]);

  const toggleCategory = (area, cat) => {
    const next = { ...cats };
    next[area] = new Set(next[area] || []);
    if (next[area].has(cat)) next[area].delete(cat);
    else next[area].add(cat);
    onChange(serializeOperatorTags(areas, next));
  };

  const enabledAreas = [...areas].filter(a => CATEGORY_CATALOG[a]);

  if (enabledAreas.length === 0) {
    return (
      <p className="text-sm text-slate-500 italic">
        Enable a service area above (e.g. Banquet, Restaurant) to assign sub-categories.
      </p>
    );
  }

  return (
    <div className={`space-y-${dense ? '3' : '4'}`} data-testid="operator-categories-panel">
      {enabledAreas.map(area => {
        const catalog = CATEGORY_CATALOG[area] || [];
        const selected = cats[area] || new Set();
        return (
          <div key={area} className={`rounded-lg border bg-white ${dense ? 'p-3' : 'p-4'}`} data-testid={`operator-categories-area-${area}`}>
            <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600 capitalize">
              {area} sub-categories
            </Label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {catalog.map(c => {
                const Icon = c.icon;
                const on = selected.has(c.value);
                return (
                  <Badge
                    key={c.value}
                    variant={on ? 'default' : 'outline'}
                    className="cursor-pointer inline-flex items-center gap-1.5"
                    onClick={() => toggleCategory(area, c.value)}
                    data-testid={`operator-category-chip-${area}-${c.value}`}
                  >
                    {Icon && <Icon className="w-3 h-3" />}
                    {c.label}
                  </Badge>
                );
              })}
            </div>
            {selected.size === 0 && (
              <p className="text-xs text-slate-400 mt-2 italic">
                No sub-categories selected yet — this operator won&apos;t appear in {area}-category dropdowns until tagged or until they create their first {area} service.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
