import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';

/**
 * Reusable shell for service create/edit modals.
 *
 * Renders:
 *  - Branded gradient header (color via `accent`)
 *  - Optional approval banner
 *  - 2-col body at lg+ (form left, sticky preview right)
 *  - Sticky footer with Cancel + Submit
 *
 * Props:
 *  - open, onOpenChange
 *  - icon (lucide component) shown in header
 *  - title (string)
 *  - subtitle (string)
 *  - editing (boolean) — toggles title text + footer label
 *  - showApprovalBanner (boolean) — show "Admin approval required" notice
 *  - approvalBannerEditing (boolean) — show "Awaiting admin approval" while editing a pending entity
 *  - statusBadge (ReactNode) — rendered top-right of header (e.g. <StatusBadge value={editing.status} />)
 *  - accent: 'red' | 'navy' | 'orange' | 'blue' | 'emerald' | 'pink'
 *  - leftColumn (ReactNode) — form sections
 *  - preview (ReactNode) — preview card (will be wrapped in a sticky container)
 *  - submitLabel (string)
 *  - submitting (boolean)
 *  - onSubmit (function)
 *  - onCancel (function) — defaults to closing
 *  - submitDataTestId (string)
 */
const ACCENT_CLASSES = {
  red:     { bg: 'from-red-700 via-red-600 to-rose-600', btn: 'bg-red-600 hover:bg-red-700' },
  navy:    { bg: 'from-[#082c59] via-[#0a3a75] to-[#0d4a8f]', btn: 'bg-[#082c59] hover:bg-[#0a3a75]' },
  orange:  { bg: 'from-orange-600 via-orange-500 to-amber-500', btn: 'bg-orange-600 hover:bg-orange-700' },
  blue:    { bg: 'from-blue-700 via-blue-600 to-sky-500', btn: 'bg-blue-600 hover:bg-blue-700' },
  emerald: { bg: 'from-emerald-700 via-emerald-600 to-teal-500', btn: 'bg-emerald-600 hover:bg-emerald-700' },
  pink:    { bg: 'from-pink-600 via-rose-500 to-fuchsia-500', btn: 'bg-pink-600 hover:bg-pink-700' },
};

export default function ServiceFormShell({
  open,
  onOpenChange,
  icon: Icon,
  title,
  subtitle,
  editing = false,
  showApprovalBanner = false,
  approvalBannerEditing = false,
  statusBadge = null,
  accent = 'red',
  leftColumn,
  preview,
  submitLabel,
  submitting = false,
  onSubmit,
  onCancel,
  submitDataTestId = 'service-form-submit-btn',
  testId = 'service-form-shell',
}) {
  const acc = ACCENT_CLASSES[accent] || ACCENT_CLASSES.red;

  const handleSubmit = (e) => {
    if (e?.preventDefault) e.preventDefault();
    onSubmit?.(e);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl bg-white max-h-[94vh] overflow-y-auto p-0" data-testid={testId}>
        {/* Branded header */}
        <div className={`bg-gradient-to-r ${acc.bg} text-white px-6 py-5`}>
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle className="text-white text-2xl flex items-center gap-2">
                  {Icon ? <Icon className="h-6 w-6" /> : null} {title}
                </DialogTitle>
                {subtitle && <p className="text-white/80 text-sm mt-1">{subtitle}</p>}
              </div>
              {statusBadge && <div className="flex-shrink-0">{statusBadge}</div>}
            </div>
          </DialogHeader>
        </div>

        {/* Approval banners */}
        {showApprovalBanner && !editing && (
          <div className="mx-6 mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <strong className="font-semibold">Admin approval required.</strong> New entries start as
              <span className="mx-1 inline-flex items-center px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-medium">Pending Approval</span>
              and are reviewed by an admin via the Validation page. You'll be notified when it's activated.
            </div>
          </div>
        )}

        {showApprovalBanner && editing && approvalBannerEditing && (
          <div className="mx-6 mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              This entry is awaiting <strong>admin approval</strong>. Edits won't bypass the review.
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="px-6 py-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: form fields */}
            <div className="lg:col-span-2 space-y-5">{leftColumn}</div>

            {/* Right: live preview */}
            <div className="lg:col-span-1">
              <div className="lg:sticky lg:top-4 space-y-4">
                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Live Preview
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-400 normal-case font-normal">how customers will see it</span>
                </div>
                {preview}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4 mt-6 -mx-6 px-6 sticky bottom-0 bg-white">
            <Button
              type="button"
              variant="outline"
              onClick={() => (onCancel ? onCancel() : onOpenChange(false))}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className={`${acc.btn} text-white`}
              disabled={submitting}
              data-testid={submitDataTestId}
            >
              {submitting ? 'Saving…' : submitLabel || (editing ? 'Update' : 'Create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
