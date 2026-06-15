// Banquet — Services grid (extracted from BanquetManagement.jsx for size hygiene).
//
// Renders the paginated list of services in either "grid" or "details"
// view. Pure presentation: parent owns the data, filtering, paging.
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PermissionGate from '@/components/common/PermissionGate';
import {
  MapPin, Users, Box, Layers, Building2, PartyPopper, Eye, Edit, Trash2,
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';

export default function ServicesGrid({
  services,            // visible (paged) services
  hasFilters,          // bool — drives the empty-state copy
  viewMode,            // 'grid' | 'details'
  categoryByValue,     // CATEGORY_BY_VALUE map
  pricingLabel,        // PRICING_LABEL map
  loading,
  onView,
  onEdit,
  onDelete,
}) {
  if (loading) return <div className="text-center py-8">Loading…</div>;
  if (services.length === 0) {
    return (
      <Card className="p-12 text-center">
        <PartyPopper className="h-16 w-16 mx-auto text-slate-300 mb-4" />
        <p className="text-slate-500">
          {hasFilters
            ? 'No services match your filters'
            : 'No services yet. Click "Add Service" to get started.'}
        </p>
      </Card>
    );
  }

  return (
    <div
      className={viewMode === 'details'
        ? 'space-y-4'
        : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'}
      data-testid={`services-${viewMode}-view`}
    >
      {services.map(svc => {
        const meta = categoryByValue[svc.category || 'hall'] || categoryByValue.hall;
        const Icon = meta.icon;
        const cover = (svc.images && svc.images[0]) || null;
        const detailEntries = Object.entries(svc.category_details || {})
          .filter(([, v]) => v !== '' && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0))
          .slice(0, 4);
        return (
          <Card key={svc.id} className="overflow-hidden hover:shadow-xl transition-shadow group" data-testid={`service-card-${svc.id}`}>
            {/* Cover image — full-bleed; falls back to a tinted icon hero */}
            <div className="relative h-40 w-full bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden">
              {cover ? (
                <img src={cover} alt={svc.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              ) : (
                <div className={`w-full h-full flex items-center justify-center ${meta.accent}`}>
                  <Icon className="w-14 h-14 opacity-50" />
                </div>
              )}
              <div className="absolute top-2 left-2">
                <Badge className={`${meta.accent} border-0 shadow-sm inline-flex items-center gap-1`}>
                  <Icon className="w-3.5 h-3.5" /> {meta.label}
                </Badge>
              </div>
              {svc.images && svc.images.length > 1 && (
                <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">
                  +{svc.images.length - 1} more
                </div>
              )}
              <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between">
                <div className="bg-white/95 backdrop-blur px-2.5 py-1 rounded-md shadow-sm">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
                    {pricingLabel[svc.pricing_model || svc.price_type] || 'Price'}
                  </div>
                  <div className="text-sm font-bold text-emerald-700 leading-tight">{formatFCFA(svc.base_price || 0)}</div>
                </div>
              </div>
            </div>

            <CardContent className="pt-3 pb-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold leading-tight line-clamp-1" title={svc.name}>{svc.name}</h3>
              </div>

              {svc.description && (
                <p className="text-xs text-slate-500 line-clamp-2 mb-2">{svc.description}</p>
              )}

              <div className="space-y-1 text-xs text-slate-600">
                {svc.city && (
                  <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{svc.address ? `${svc.address}, ` : ''}{svc.city}</span>
                  </div>
                )}
                {(svc.capacity_max != null) && (
                  <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />{svc.capacity_min || 0}–{svc.capacity_max} guests</div>
                )}
                {svc.unit_label && (
                  <div className="flex items-center gap-1.5"><Box className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    Sold by the <strong className="font-medium">{svc.unit_label}</strong>
                    {svc.min_quantity ? ` (min ${svc.min_quantity})` : ''}
                  </div>
                )}
                {svc.duration_hours && (
                  <div className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />Default {svc.duration_hours}h session</div>
                )}
              </div>

              {detailEntries.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {detailEntries.map(([k, v]) => (
                    <Badge key={k} variant="outline" className="text-[10px] font-normal py-0 px-1.5 text-slate-600">
                      {String(k).replace(/_/g, ' ')}: <strong className="font-medium ml-1 truncate max-w-[120px]">{Array.isArray(v) ? v.join(', ') : String(v)}</strong>
                    </Badge>
                  ))}
                </div>
              )}

              {Array.isArray(svc.amenities) && svc.amenities.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {svc.amenities.slice(0, 3).map(a => (
                    <Badge key={a} variant="secondary" className="text-[10px] font-normal py-0 px-1.5">{String(a).replace(/_/g, ' ')}</Badge>
                  ))}
                  {svc.amenities.length > 3 && (
                    <Badge variant="secondary" className="text-[10px] font-normal py-0 px-1.5 text-slate-500">+{svc.amenities.length - 3}</Badge>
                  )}
                </div>
              )}

              {(svc.operator_name || svc.phone || svc.email) && (
                <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between gap-2">
                  {svc.operator_name && <span className="inline-flex items-center gap-1 truncate"><Building2 className="w-3 h-3" /> {svc.operator_name}</span>}
                  {(svc.phone || svc.email) && (
                    <span className="truncate text-right">{svc.phone || svc.email}</span>
                  )}
                </div>
              )}

              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={() => onView(svc)} title="View details" data-testid={`view-service-btn-${svc.id}`}>
                  <Eye className="w-4 h-4" />
                </Button>
                <PermissionGate permission="banquets.edit">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => onEdit(svc)} data-testid={`edit-service-btn-${svc.id}`}>
                    <Edit className="w-4 h-4 mr-1" /> Edit
                  </Button>
                </PermissionGate>
                <PermissionGate permission="banquets.delete">
                  <Button size="sm" variant="outline" className="text-red-600" onClick={() => onDelete(svc.id)} data-testid={`delete-service-btn-${svc.id}`}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </PermissionGate>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
