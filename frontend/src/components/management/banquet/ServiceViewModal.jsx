// Banquet — Service view-only modal (rich preview matching customer card).
//
// Extracted from BanquetManagement.jsx. Parent owns `viewing` (the service)
// and supplies `onEdit` to swap into the edit dialog.
import React from 'react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Users, Box, Layers, Building2, Edit } from 'lucide-react';
import { formatFCFA } from '@/utils/currency';

export default function ServiceViewModal({
  open, onOpenChange, viewing, categoryByValue, pricingLabel, onEdit,
}) {
  if (!viewing) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto p-0" />
      </Dialog>
    );
  }
  const meta = categoryByValue[viewing.category || 'hall'] || categoryByValue.hall;
  const Icon = meta.icon;
  const images = Array.isArray(viewing.images) ? viewing.images.filter(Boolean) : [];
  const cover = images[0];
  const thumbs = images.slice(1, 6);
  const detailEntries = Object.entries(viewing.category_details || {})
    .filter(([, v]) => v !== '' && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto p-0">
        <div className="relative h-56 w-full overflow-hidden">
          {cover ? (
            <img src={cover} alt={viewing.name} className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full flex items-center justify-center ${meta.accent}`}>
              <Icon className="w-20 h-20 opacity-50" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
            <div className="text-white drop-shadow">
              <Badge className={`${meta.accent} border-0 mb-1 inline-flex items-center gap-1`}>
                <Icon className="w-3.5 h-3.5" /> {meta.label}
              </Badge>
              <h2 className="text-2xl font-bold leading-tight">{viewing.name}</h2>
            </div>
            <div className="bg-white/95 backdrop-blur rounded-md px-3 py-1.5 shadow text-right flex-shrink-0">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">{pricingLabel[viewing.pricing_model || viewing.price_type] || 'Price'}</div>
              <div className="text-base font-bold text-emerald-700">{formatFCFA(viewing.base_price || 0)}</div>
            </div>
          </div>
        </div>

        {thumbs.length > 0 && (
          <div className="px-5 pt-3 flex gap-2 overflow-x-auto pb-1">
            {thumbs.map((src, i) => (
              <img key={i} src={src} alt="" className="w-16 h-16 rounded-md object-cover flex-shrink-0 ring-1 ring-slate-200" />
            ))}
            {images.length > 6 && (
              <div className="w-16 h-16 rounded-md bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-500 flex-shrink-0">
                +{images.length - 6}
              </div>
            )}
          </div>
        )}

        <div className="px-5 py-4 space-y-4">
          {viewing.description && (
            <p className="text-sm text-slate-700 leading-relaxed">{viewing.description}</p>
          )}

          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {(viewing.address || viewing.city) && (
              <div className="col-span-2">
                <p className="text-[11px] uppercase text-slate-500 tracking-wide font-semibold mb-0.5">Location</p>
                <p className="font-medium flex items-center gap-1.5"><MapPin className="w-4 h-4 text-slate-400" />{viewing.address ? `${viewing.address}, ` : ''}{viewing.city}</p>
              </div>
            )}
            {(viewing.capacity_min != null || viewing.capacity_max != null) && (
              <div>
                <p className="text-[11px] uppercase text-slate-500 tracking-wide font-semibold mb-0.5">Capacity</p>
                <p className="font-medium flex items-center gap-1.5"><Users className="w-4 h-4 text-slate-400" />{viewing.capacity_min || 0}–{viewing.capacity_max || '∞'} guests</p>
              </div>
            )}
            {viewing.duration_hours && (
              <div>
                <p className="text-[11px] uppercase text-slate-500 tracking-wide font-semibold mb-0.5">Default duration</p>
                <p className="font-medium flex items-center gap-1.5"><Layers className="w-4 h-4 text-slate-400" />{viewing.duration_hours}h session</p>
              </div>
            )}
            {viewing.unit_label && (
              <div>
                <p className="text-[11px] uppercase text-slate-500 tracking-wide font-semibold mb-0.5">Unit</p>
                <p className="font-medium flex items-center gap-1.5"><Box className="w-4 h-4 text-slate-400" />per {viewing.unit_label}{viewing.min_quantity ? ` (min ${viewing.min_quantity})` : ''}</p>
              </div>
            )}
            {viewing.operator_name && (
              <div>
                <p className="text-[11px] uppercase text-slate-500 tracking-wide font-semibold mb-0.5">Operator</p>
                <p className="font-medium flex items-center gap-1.5"><Building2 className="w-4 h-4 text-slate-400" />{viewing.operator_name}</p>
              </div>
            )}
            {(viewing.phone || viewing.email) && (
              <div className="col-span-2">
                <p className="text-[11px] uppercase text-slate-500 tracking-wide font-semibold mb-0.5">Contact</p>
                <p className="font-medium text-slate-700">{[viewing.phone, viewing.email].filter(Boolean).join(' · ')}</p>
              </div>
            )}
          </div>

          {detailEntries.length > 0 && (
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <p className="text-[11px] uppercase text-slate-500 tracking-wide font-semibold mb-2">{meta.label} details</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {detailEntries.map(([k, v]) => (
                  <div key={k} className="bg-white rounded px-2 py-1.5 border border-slate-100">
                    <div className="text-[10px] text-slate-500 capitalize">{String(k).replace(/_/g, ' ')}</div>
                    <div className="font-medium text-slate-800 truncate">{Array.isArray(v) ? v.join(', ') : String(v)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(viewing.amenities) && viewing.amenities.length > 0 && (
            <div>
              <p className="text-[11px] uppercase text-slate-500 tracking-wide font-semibold mb-2">Includes</p>
              <div className="flex flex-wrap gap-1.5">
                {viewing.amenities.map(a => (
                  <Badge key={a} variant="outline" className="text-xs font-normal capitalize">{String(a).replace(/_/g, ' ')}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-5 pb-5 pt-0 border-t">
          <Button variant="outline" onClick={() => { onEdit(viewing); onOpenChange(false); }}>
            <Edit className="w-4 h-4 mr-2" /> Edit
          </Button>
          <Button onClick={() => onOpenChange(false)} className="bg-[#082c59]">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
