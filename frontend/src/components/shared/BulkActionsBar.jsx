// Sticky bottom bar that appears when ≥1 row is selected in a management
// list. Renders the count + a configurable cluster of bulk actions
// (delete/export/activate/deactivate by default). Each booking, management,
// and admin page wires this in via the `useBulkSelection` hook.

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, Download, ToggleLeft, ToggleRight, X, Loader2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

/**
 * @param {Object} props
 * @param {number}  props.count        - number of rows selected
 * @param {string}  props.entityLabel  - singular noun (e.g. "operator")
 * @param {Array}   props.selectedRows - the actual row objects (for export)
 * @param {Function} props.onClear     - called when the user dismisses the bar
 * @param {Function} props.onDelete    - async (ids) => void
 * @param {Function} [props.onExport]  - async (rows) => CSV-able array (or omit to disable)
 * @param {Function} [props.onActivate] - async (ids) => void
 * @param {Function} [props.onDeactivate] - async (ids) => void
 * @param {Array<string>} [props.selectedIds]
 */
export default function BulkActionsBar({
  count = 0,
  entityLabel = 'item',
  selectedRows = [],
  selectedIds = [],
  onClear,
  onDelete,
  onExport,
  onActivate,
  onDeactivate,
  customActions = [], // [{ key, label, icon, variant, onClick }]
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(null); // 'delete' | 'activate' | …

  if (count === 0) return null;
  const ids = selectedIds.length ? selectedIds : selectedRows.map((r) => r.id || r._id);

  const handleDelete = async () => {
    setBusy('delete');
    try {
      await onDelete(ids);
      toast.success(`${count} ${entityLabel}${count > 1 ? 's' : ''} deleted`);
      setConfirmingDelete(false);
      onClear?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || `Failed to delete ${entityLabel}s`);
    } finally { setBusy(null); }
  };

  const handleActivate = async (active) => {
    const fn = active ? onActivate : onDeactivate;
    setBusy(active ? 'activate' : 'deactivate');
    try {
      await fn(ids);
      toast.success(`${count} ${entityLabel}${count > 1 ? 's' : ''} ${active ? 'activated' : 'deactivated'}`);
      onClear?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Bulk action failed');
    } finally { setBusy(null); }
  };

  const handleExportCsv = async () => {
    const rows = typeof onExport === 'function' ? await onExport(selectedRows) : selectedRows;
    if (!rows?.length) { toast.error('Nothing to export'); return; }
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entityLabel}-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} rows`);
  };

  return (
    <>
      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 px-4 py-3 flex items-center gap-3 min-w-[480px]"
        data-testid="bulk-actions-bar"
      >
        <div className="flex items-center gap-2">
          <span className="bg-pink-500 text-white text-xs font-bold rounded-full w-7 h-7 flex items-center justify-center" data-testid="bulk-count">
            {count}
          </span>
          <span className="text-sm font-medium">{entityLabel}{count > 1 ? 's' : ''} selected</span>
        </div>
        <div className="flex-1 h-6 border-r border-slate-700 mx-1" />
        <div className="flex items-center gap-1.5">
          {onActivate && (
            <Button size="sm" variant="ghost" className="text-emerald-300 hover:bg-slate-800 hover:text-emerald-200 h-8" onClick={() => handleActivate(true)} disabled={!!busy} data-testid="bulk-activate-btn">
              {busy === 'activate' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ToggleRight className="w-3.5 h-3.5" />}
              <span className="ml-1">Activate</span>
            </Button>
          )}
          {onDeactivate && (
            <Button size="sm" variant="ghost" className="text-amber-300 hover:bg-slate-800 hover:text-amber-200 h-8" onClick={() => handleActivate(false)} disabled={!!busy} data-testid="bulk-deactivate-btn">
              {busy === 'deactivate' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ToggleLeft className="w-3.5 h-3.5" />}
              <span className="ml-1">Deactivate</span>
            </Button>
          )}
          {(onExport || selectedRows.length > 0) && (
            <Button size="sm" variant="ghost" className="text-slate-300 hover:bg-slate-800 hover:text-white h-8" onClick={handleExportCsv} data-testid="bulk-export-btn">
              <Download className="w-3.5 h-3.5" />
              <span className="ml-1">Export CSV</span>
            </Button>
          )}
          {customActions.map((a) => (
            <Button
              key={a.key}
              size="sm"
              variant="ghost"
              className={`hover:bg-slate-800 h-8 ${a.variant === 'danger' ? 'text-rose-300 hover:text-rose-200' : 'text-slate-300 hover:text-white'}`}
              onClick={() => a.onClick(ids, selectedRows)}
              disabled={!!busy}
              data-testid={`bulk-custom-${a.key}`}
            >
              {a.icon}
              <span className="ml-1">{a.label}</span>
            </Button>
          ))}
          {onDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="text-rose-300 hover:bg-rose-900/40 hover:text-rose-200 h-8"
              onClick={() => setConfirmingDelete(true)}
              disabled={!!busy}
              data-testid="bulk-delete-btn"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="ml-1">Delete</span>
            </Button>
          )}
        </div>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={onClear} data-testid="bulk-clear-btn">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {count} {entityLabel}{count > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the selected rows. Cascading data (orders, refunds, etc.)
              may be retained depending on the resource type. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === 'delete'}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={busy === 'delete'}
              className="bg-rose-600 hover:bg-rose-700 text-white"
              data-testid="bulk-delete-confirm-btn"
            >
              {busy === 'delete' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete {count} {entityLabel}{count > 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Reusable header checkbox + per-row cell so management lists don't reinvent the wheel. */
export function BulkSelectHeader({ allSelected, partiallySelected, onToggleAll, testid = 'bulk-select-all' }) {
  return (
    <input
      type="checkbox"
      checked={allSelected}
      ref={(el) => { if (el) el.indeterminate = partiallySelected; }}
      onChange={onToggleAll}
      className="rounded border-slate-300 focus:ring-pink-500 cursor-pointer w-4 h-4"
      data-testid={testid}
    />
  );
}

export function BulkSelectCell({ selected, onToggle, id }) {
  return (
    <input
      type="checkbox"
      checked={selected}
      onChange={(e) => { e.stopPropagation(); onToggle(id); }}
      onClick={(e) => e.stopPropagation()}
      className="rounded border-slate-300 focus:ring-pink-500 cursor-pointer w-4 h-4"
      data-testid={`bulk-select-row-${id}`}
    />
  );
}
