import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Monitor, Plus, Trash2, LayoutGrid, Armchair,
} from 'lucide-react';
import ServiceFormShell from '@/components/management/shared/ServiceFormShell';
import GenericPreviewCard from '@/components/management/shared/GenericPreviewCard';
import MiniImageUploader from '@/components/shared/MiniImageUploader';
import OperatorSelector from '@/components/management/shared/OperatorSelector';
import CinemaSeatBuilder from '@/components/cinema/CinemaSeatBuilder';
import { CINEMA_AMENITIES, SCREEN_TYPES } from '@/components/cinema/cinemaConstants';

/**
 * Dialog (ServiceFormShell) used to create or edit a Cinema venue. Kept as a
 * dumb component — all state lives in the parent CinemaManagement page.
 */
export default function CinemaFormDialog({
  open,
  onOpenChange,
  editingCinema,
  cinemaForm,
  setCinemaForm,
  expandedScreenIdx,
  setExpandedScreenIdx,
  operators,
  onSubmit,
}) {
  return (
    <ServiceFormShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Monitor}
      title={editingCinema ? 'Edit Cinema' : 'Add New Cinema'}
      subtitle={editingCinema
        ? 'Update venue info, screens and amenities. Customers see this on the cinema page.'
        : 'Register a new cinema venue — name, screens, amenities and contact info.'}
      editing={!!editingCinema}
      accent="red"
      leftColumn={
        <div className="space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Venue photos</Label>
            <div className="mt-2">
              <MiniImageUploader
                images={cinemaForm.images || []}
                onChange={(imgs) => setCinemaForm(p => ({ ...p, images: imgs }))}
                max={3}
                folder="cinemas"
                accent="red"
                helperText="Up to 3 photos of the venue. The first is the cover."
              />
            </div>
          </div>
          <div>
            <Label>Name *</Label>
            <Input value={cinemaForm.name} onChange={e => setCinemaForm(p => ({ ...p, name: e.target.value }))} placeholder="Canal Olympia Yaoundé" data-testid="cinema-name-input" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>City *</Label>
              <Input value={cinemaForm.city} onChange={e => setCinemaForm(p => ({ ...p, city: e.target.value }))} placeholder="Yaoundé" data-testid="cinema-city-input" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={cinemaForm.phone} onChange={e => setCinemaForm(p => ({ ...p, phone: e.target.value }))} placeholder="+237..." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Address</Label>
              <Input value={cinemaForm.address} onChange={e => setCinemaForm(p => ({ ...p, address: e.target.value }))} placeholder="Full address" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={cinemaForm.email} onChange={e => setCinemaForm(p => ({ ...p, email: e.target.value }))} placeholder="contact@cinema.com" />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={cinemaForm.description} onChange={e => setCinemaForm(p => ({ ...p, description: e.target.value }))} placeholder="About this cinema..." rows={2} />
          </div>

          {/* Screens management */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Screens & seat layout</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setCinemaForm(p => ({
                  ...p,
                  screens: [...(p.screens || []), { name: `Screen ${(p.screens?.length || 0) + 1}`, type: '2d', capacity: 96, seat_layout: { rows: 8, cols: 12, aisle_after_col: [6], vip_rows: [], blocked: [] } }],
                }))}
                data-testid="add-screen-btn"
              >
                <Plus className="w-3 h-3 mr-1" /> Add screen
              </Button>
            </div>
            <p className="text-[11px] text-slate-500 -mt-1 mb-2">Each screen can have its own seat layout. The layout is used at booking time for visual seat selection.</p>
            <div className="space-y-3">
              {(cinemaForm.screens || []).length === 0 && (
                <p className="text-xs text-slate-500 italic">No screens yet. Click "Add screen" to add theater rooms.</p>
              )}
              {(cinemaForm.screens || []).map((screen, idx) => {
                const layout = screen.seat_layout || { rows: 8, cols: 12, aisle_after_col: [6], vip_rows: [], blocked: [] };
                const computedCapacity = (layout.rows || 0) * (layout.cols || 0) - (layout.blocked || []).length;
                return (
                  <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                    <div className="grid grid-cols-12 gap-2 items-center p-3">
                      <Input
                        className="col-span-4 bg-white"
                        placeholder="Screen name"
                        value={screen.name || ''}
                        onChange={(e) => setCinemaForm(p => ({
                          ...p,
                          screens: p.screens.map((s, i) => i === idx ? { ...s, name: e.target.value } : s),
                        }))}
                        data-testid={`screen-name-${idx}`}
                      />
                      <Select
                        value={screen.type || '2d'}
                        onValueChange={(v) => setCinemaForm(p => ({
                          ...p,
                          screens: p.screens.map((s, i) => i === idx ? { ...s, type: v } : s),
                        }))}
                      >
                        <SelectTrigger className="col-span-3 bg-white" data-testid={`screen-type-${idx}`}><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-white">
                          {SCREEN_TYPES.map((t) => <SelectItem key={t} value={t} className="uppercase">{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <div className="col-span-3 flex items-center gap-1.5 px-2 py-1.5 bg-white rounded border border-slate-200 text-xs">
                        <Armchair className="h-3.5 w-3.5 text-slate-500" />
                        <span className="font-semibold text-slate-700 tabular-nums">{computedCapacity}</span>
                        <span className="text-slate-500">seats</span>
                      </div>
                      <div className="col-span-2 flex justify-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 text-cyan-700 border-cyan-300 bg-cyan-50 hover:bg-cyan-100"
                          onClick={() => setExpandedScreenIdx(expandedScreenIdx === idx ? null : idx)}
                          data-testid={`screen-toggle-builder-${idx}`}
                        >
                          <LayoutGrid className="h-3.5 w-3.5 mr-1" />
                          {expandedScreenIdx === idx ? 'Hide' : 'Layout'}
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="text-red-500 h-8"
                          onClick={() => setCinemaForm(p => ({ ...p, screens: p.screens.filter((_, i) => i !== idx) }))}
                          data-testid={`screen-delete-${idx}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {expandedScreenIdx === idx && (
                      <div className="p-3 pt-0">
                        <CinemaSeatBuilder
                          value={layout}
                          onChange={(newLayout) => setCinemaForm(p => ({
                            ...p,
                            screens: p.screens.map((s, i) => i === idx
                              ? { ...s, seat_layout: newLayout, capacity: (newLayout.rows || 0) * (newLayout.cols || 0) - (newLayout.blocked || []).length }
                              : s),
                          }))}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <OperatorSelector
              value={cinemaForm.operator_id || ''}
              onChange={(id, name) => setCinemaForm(p => ({ ...p, operator_id: id, operator_name: name }))}
              operators={operators}
              testId="cinema-operator-selector"
            />
          </div>
          <div>
            <Label>Amenities</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {CINEMA_AMENITIES.map(amenity => (
                <Badge
                  key={amenity}
                  variant={cinemaForm.amenities?.includes(amenity) ? 'default' : 'outline'}
                  className="cursor-pointer uppercase text-xs"
                  onClick={() => {
                    setCinemaForm(p => ({
                      ...p,
                      amenities: p.amenities?.includes(amenity)
                        ? p.amenities.filter(a => a !== amenity)
                        : [...(p.amenities || []), amenity],
                    }));
                  }}
                >
                  {amenity.replace('_', ' ')}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      }
      preview={
        <GenericPreviewCard
          cover={(cinemaForm.images || [])[0]}
          thumbs={(cinemaForm.images || []).slice(1, 3)}
          icon={Monitor}
          badgeText="Cinema"
          badgeClass="bg-red-500 text-white"
          placeholderColor="from-red-700 via-red-600 to-rose-600"
          title={cinemaForm.name || 'Cinema name'}
          subtitle={cinemaForm.phone || cinemaForm.email || 'Contact'}
          location={[cinemaForm.address, cinemaForm.city].filter(Boolean).join(' · ') || 'Address · City'}
          tags={cinemaForm.amenities || []}
          tagsAccentClass="bg-red-50 text-red-700"
          priceLabel="Screens"
          priceValue={(cinemaForm.screens || []).length > 0
            ? `${cinemaForm.screens.length} screen${cinemaForm.screens.length === 1 ? '' : 's'}`
            : '—'}
          accentTextClass="text-red-700"
        />
      }
      submitting={false}
      submitLabel={editingCinema ? 'Update Cinema' : 'Add Cinema'}
      onSubmit={onSubmit}
      submitDataTestId="save-cinema-btn"
    />
  );
}
