import React from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Search, MapPin } from 'lucide-react';
import { getIconComponent } from '@/utils/icons';

const TYPE_LABEL = {
  location: 'Locations',
  operator: 'Operators',
  hotel: 'Hotels',
  event: 'Events',
  cinema: 'Cinema',
  restaurant: 'Restaurants',
  travel_route: 'Travel routes',
  car_rental: 'Car rentals',
  banquet: 'Venues',
  laundry: 'Laundry',
  user: 'Users',
  order: 'Orders',
  page: 'Pages',
};

// Render a thumbnail OR fallback to a service-type icon over a colour swatch.
function Thumb({ row }) {
  const Icon = typeof row.icon === 'string' ? getIconComponent(row.icon) : (row.icon || Search);
  if (row.thumbnail) {
    return (
      <img
        src={row.thumbnail}
        alt={row.label}
        className="h-12 w-12 rounded-lg object-cover bg-slate-100 border border-slate-200 flex-shrink-0"
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
    );
  }
  return (
    <div
      className="h-12 w-12 rounded-lg flex items-center justify-center flex-shrink-0 border border-slate-200"
      style={{ backgroundColor: `${row.color}15` }}
    >
      <Icon className="h-6 w-6" style={{ color: row.color }} />
    </div>
  );
}

export default function GlobalSearchAllModal({ open, onOpenChange, query, byType, onSelect }) {
  const groups = Object.entries(byType || {});
  const total = groups.reduce((acc, [, items]) => acc + items.length, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl bg-white max-h-[85vh] overflow-hidden flex flex-col p-0"
        data-testid="global-search-all-modal"
      >
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-[#082c59]" />
            <span>All results for <span className="text-[#082c59]">"{query}"</span></span>
            <Badge variant="outline" className="ml-2 text-[10px] font-bold">{total}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {groups.length === 0 ? (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No matches.</p>
            </div>
          ) : groups.map(([type, items]) => (
            <section key={type} data-testid={`gs-modal-section-${type}`}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">
                  {TYPE_LABEL[type] || type}
                </h3>
                <span className="text-[10px] text-slate-400">{items.length}</span>
              </div>
              <div className="space-y-1.5">
                {items.map((row, i) => (
                  <button
                    key={(row.deep_link || row.path) + i}
                    onClick={() => onSelect && onSelect(row)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 hover:border-[#082c59]/20 border border-transparent transition-all text-left group"
                    data-testid={`gs-modal-row-${type}-${i}`}
                  >
                    <Thumb row={row} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-slate-900 truncate">{row.label}</p>
                      <p className="text-[11px] text-slate-500 truncate">{row.subtitle || row.description}</p>
                      {row.meta?.city && type !== 'location' && (
                        <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] text-slate-400">
                          <MapPin className="h-2.5 w-2.5" /> {row.meta.city}
                        </span>
                      )}
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-[#082c59] group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
