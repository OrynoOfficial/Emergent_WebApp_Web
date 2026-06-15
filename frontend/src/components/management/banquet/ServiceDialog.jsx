// Banquet — Add/Edit Service dialog (extracted from BanquetManagement.jsx).
//
// Wraps the `ServiceFormShell` two-column dialog with the right-column
// preview card. Parent owns `form` + `categoryOperators` and supplies
// the LeftColumn renderer (CategoryAwareFields).
import React from 'react';
import ServiceFormShell from '@/components/management/shared/ServiceFormShell';
import GenericPreviewCard from '@/components/management/shared/GenericPreviewCard';

export default function ServiceDialog({
  open, onOpenChange,
  editing, form,
  previewMeta,
  pricingLabel,
  leftColumn,
  onSubmit,
}) {
  return (
    <ServiceFormShell
      open={open}
      onOpenChange={onOpenChange}
      icon={previewMeta.icon}
      title={editing ? 'Edit Service' : 'Add Service'}
      subtitle={editing
        ? 'Update category, pricing and photos.'
        : 'List a new service — hall, rental items, canopy, photographer, catering, anything you offer for events.'}
      editing={!!editing}
      accent="pink"
      leftColumn={leftColumn}
      preview={
        <div className="space-y-3">
          <GenericPreviewCard
            cover={(form.images || [])[0]}
            thumbs={(form.images || []).slice(1, 3)}
            icon={previewMeta.icon}
            badgeText={previewMeta.label}
            badgeClass="bg-pink-500 text-white"
            placeholderColor="from-pink-600 via-rose-500 to-fuchsia-500"
            title={form.name || 'Service name'}
            subtitle={form.category === 'hall' ? (form.venue_type || 'Venue') : previewMeta.label}
            location={[
              form.city,
              form.capacity_max ? `Up to ${form.capacity_max} guests` : null,
              form.unit_label ? `Sold by the ${form.unit_label}` : null,
            ].filter(Boolean).join(' · ') || (form.category === 'hall' ? 'City · Capacity' : 'Service details')}
            tags={form.amenities || []}
            tagsAccentClass="bg-pink-50 text-pink-700"
            priceLabel={pricingLabel[form.pricing_model] || 'Price'}
            priceValue={form.base_price ? `${Number(form.base_price).toLocaleString()} FCFA` : '—'}
            accentTextClass="text-pink-700"
          />

          {/* Gallery — all uploaded photos surfaced so operator sees what they've added */}
          {Array.isArray(form.images) && form.images.length > 3 && (
            <div className="bg-white rounded-xl border border-slate-200 p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">
                Gallery · {form.images.length} photos
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {form.images.slice(0, 8).map((img, i) => (
                  <img key={i} src={img} alt="" className="aspect-square rounded-md object-cover" />
                ))}
                {form.images.length > 8 && (
                  <div className="aspect-square rounded-md bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-500">
                    +{form.images.length - 8}
                  </div>
                )}
              </div>
            </div>
          )}

          {form.description && (
            <div className="bg-white rounded-xl border border-slate-200 p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">About</div>
              <p className="text-xs text-slate-700 leading-relaxed line-clamp-5">{form.description}</p>
            </div>
          )}

          <CategoryDetailsPreview form={form} previewMeta={previewMeta} />

          {(form.operator_name || form.phone || form.email || form.duration_hours || form.min_quantity) && (
            <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-1.5">
              {form.operator_name && (
                <Row label="Operator" value={form.operator_name} />
              )}
              {form.duration_hours && (
                <Row label="Default duration" value={`${form.duration_hours}h`} />
              )}
              {form.min_quantity && (
                <Row label="Min quantity" value={form.min_quantity} />
              )}
              {form.phone && (<Row label="Phone" value={form.phone} />)}
              {form.email && (<Row label="Email" value={form.email} />)}
            </div>
          )}
        </div>
      }
      submitting={false}
      submitLabel={editing ? 'Update Service' : 'Add Service'}
      onSubmit={onSubmit}
      submitDataTestId="save-service-btn"
    />
  );
}

function CategoryDetailsPreview({ form, previewMeta }) {
  const cd = form.category_details || {};
  const entries = Object.entries(cd).filter(([, v]) =>
    v !== '' && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)
  );
  if (entries.length === 0) return null;
  return (
    <div className="bg-pink-50 rounded-xl border border-pink-200 p-3" data-testid="modal-category-details">
      <div className="text-[10px] uppercase tracking-wider text-pink-700 font-semibold mb-2">
        {previewMeta.label} details
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {entries.map(([k, v]) => (
          <div key={k} className="bg-white rounded px-2 py-1 border border-pink-100">
            <div className="text-[9px] text-slate-500 capitalize">{String(k).replace(/_/g, ' ')}</div>
            <div className="text-xs font-medium text-slate-800 truncate" title={Array.isArray(v) ? v.join(', ') : String(v)}>
              {Array.isArray(v) ? v.join(', ') : String(v)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="text-[11px] flex items-center justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800 truncate">{value}</span>
    </div>
  );
}
