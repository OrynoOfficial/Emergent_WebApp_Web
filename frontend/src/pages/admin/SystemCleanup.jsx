// Super-admin only "system cleanup" UI. Wraps backend
// /api/admin/ops/cleanup/{preview,apply}. Lets the operator preview what would
// be deleted (dry-run) before pulling the trigger, with explicit confirmation.

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Shield, RefreshCw, Trash2, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import api from '@/api/client';
import { toast } from 'sonner';

const LABELS = {
  users_matched:        ['Test Users',            'Pattern-matched user accounts (excluding 4 protected seeds)'],
  orders_matched:       ['Test Orders',           'Orders by test users or seeded showtimes'],
  showtimes_matched:    ['Test Showtimes',        'Event showtimes with smoke/QA titles'],
  locations_matched:    ['Test Locations',        'Event locations with smoke/QA names'],
  refunds:              ['Refunds',               'Refund rows tied to test orders'],
  ticket_validations:   ['Ticket Validations',    'Scanner records linked to test orders'],
  receipts:             ['Receipts',              'Receipts generated for test orders'],
  bills:                ['Bills',                 'Bills owned by test users'],
  orders:               ['Orders',                'Order documents themselves'],
  bookings:             ['Bookings (legacy)',     'Legacy booking collection'],
  event_showtimes:      ['Event Showtimes',       'Showtime documents'],
  event_locations:      ['Event Locations',       'Location documents'],
  commission_configs:   ['Commission Configs',    'Configs named QA/Smoke/Test'],
  verification_tokens_aged: ['Verification Tokens (>7d)', 'Expired email invite tokens'],
  revoked_tokens_aged:  ['Revoked Tokens (>24h)', 'Old logout/revoke records'],
  refresh_tokens_aged:  ['Refresh Tokens (>30d)', 'Aged session refresh tokens'],
  users:                ['Users',                 'The actual user documents (last so cascades resolve)'],
};

export default function SystemCleanup() {
  const { user } = useAuth();
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastApply, setLastApply] = useState(null);

  const isSuper = user?.role === 'super_admin';

  const loadPreview = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/ops/cleanup/preview');
      setPreview(data);
      toast.success('Preview loaded — nothing was deleted');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Preview failed');
    } finally { setLoading(false); }
  };

  const applyCleanup = async () => {
    setApplying(true);
    try {
      const { data } = await api.post('/admin/ops/cleanup/apply');
      setLastApply(data);
      toast.success('Cleanup applied');
      // Refresh the preview so the operator can see the new state (zeros).
      await loadPreview();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Cleanup failed');
    } finally {
      setApplying(false);
      setConfirmOpen(false);
    }
  };

  if (!isSuper) {
    return (
      <div className="p-8 max-w-2xl mx-auto" data-testid="cleanup-forbidden">
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="p-8 text-center">
            <Shield className="w-12 h-12 mx-auto text-rose-500 mb-3" />
            <h2 className="text-xl font-bold text-rose-900">Super-admin only</h2>
            <p className="text-sm text-rose-700 mt-1">
              The system cleanup tool is restricted to super_admin accounts because it
              issues destructive deletions across collections.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = preview?.stats || {};
  const totalRows = Object.entries(stats)
    .filter(([k]) => !k.endsWith('_matched'))
    .reduce((sum, [, v]) => sum + (Number(v) || 0), 0);

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6" data-testid="system-cleanup-page">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Trash2 className="w-7 h-7 text-rose-600" />
            System Cleanup
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Surgically remove rows that match seeded / QA patterns. The 4 production
            accounts (admin@, superadmin@, operator@, customer@test.com) are never
            touched. Always preview first.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={loadPreview}
            disabled={loading}
            data-testid="cleanup-preview-btn"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Preview (dry-run)
          </Button>
          <Button
            className="bg-rose-600 hover:bg-rose-700 text-white"
            onClick={() => setConfirmOpen(true)}
            disabled={!preview || applying || totalRows === 0}
            data-testid="cleanup-apply-btn"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Apply cleanup
          </Button>
        </div>
      </header>

      <Card className="border-amber-200 bg-amber-50/60">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900 space-y-1">
            <div className="font-semibold">Protected accounts (never deleted)</div>
            <div className="font-mono text-xs">
              {(preview?.protected_emails || ['admin@test.com', 'superadmin@oryno.com', 'operator@test.com', 'customer@test.com']).join('  •  ')}
            </div>
          </div>
        </CardContent>
      </Card>

      {!preview && !loading && (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center text-slate-500">
            <p className="mb-3">No preview yet.</p>
            <Button variant="outline" onClick={loadPreview} data-testid="cleanup-load-btn">
              Run dry-run to see what will be deleted
            </Button>
          </CardContent>
        </Card>
      )}

      {preview && (
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-lg flex items-center gap-2">
                Dry-run results
                <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                  {preview.mode}
                </Badge>
              </CardTitle>
              <div className="text-sm text-slate-600">
                <span className="text-2xl font-bold text-slate-900" data-testid="cleanup-total">{totalRows}</span>
                <span className="ml-1">row{totalRows === 1 ? '' : 's'} will be deleted</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left p-3 font-semibold text-slate-700">Collection / Bucket</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Description</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Rows</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats).map(([key, count]) => {
                  const [label, desc] = LABELS[key] || [key, ''];
                  const matched = key.endsWith('_matched');
                  return (
                    <tr key={key} className="border-b last:border-0 hover:bg-slate-50" data-testid={`cleanup-row-${key}`}>
                      <td className="p-3">
                        <div className="font-medium text-slate-900">{label}</div>
                        {matched && <div className="text-[10px] uppercase tracking-wide text-slate-400">scan only</div>}
                      </td>
                      <td className="p-3 text-slate-600 text-xs">{desc}</td>
                      <td className="p-3 text-right">
                        <Badge
                          variant="outline"
                          className={count > 0
                            ? (matched ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-rose-50 text-rose-700 border-rose-200')
                            : 'bg-slate-100 text-slate-500 border-slate-200'}
                        >
                          {count}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {lastApply && (
        <Card className="border-emerald-200 bg-emerald-50/60">
          <CardContent className="p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-emerald-900">
              <div className="font-semibold">Cleanup applied</div>
              <div className="text-xs">
                Completed {new Date(lastApply.completed_at).toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              Permanently delete {totalRows} row{totalRows === 1 ? '' : 's'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes all rows matched by the dry-run above. Protected production
              accounts are NEVER touched. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applying} data-testid="cleanup-cancel-btn">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); applyCleanup(); }}
              disabled={applying}
              className="bg-rose-600 hover:bg-rose-700 text-white"
              data-testid="cleanup-confirm-btn"
            >
              {applying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete {totalRows} row{totalRows === 1 ? '' : 's'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
