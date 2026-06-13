import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldAlert, Eye, EyeOff, Loader2, Check, X } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';

const PASSWORD_RULES = [
  { id: 'len',    label: 'At least 8 characters',           test: (v) => v.length >= 8 },
  { id: 'upper',  label: 'One uppercase letter (A-Z)',      test: (v) => /[A-Z]/.test(v) },
  { id: 'lower',  label: 'One lowercase letter (a-z)',      test: (v) => /[a-z]/.test(v) },
  { id: 'num',    label: 'One number (0-9)',                test: (v) => /[0-9]/.test(v) },
  { id: 'sym',    label: 'One symbol (!@#$%…)',             test: (v) => /[^A-Za-z0-9]/.test(v) },
];

/**
 * Non-dismissible dialog that blocks the entire app whenever the authenticated
 * user has `must_reset_password === true` (typically the bootstrap super-admin
 * on first sign-in). Calls `POST /api/auth/change-password`, then re-fetches
 * `/api/auth/me` so the flag flips to false and the dialog closes on its own.
 */
export default function ForcePasswordResetModal() {
  const { reAuthenticate } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const passedRules = PASSWORD_RULES.filter(r => r.test(newPassword));
  const allRulesPassed = passedRules.length === PASSWORD_RULES.length;
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = currentPassword.length > 0 && allRulesPassed && passwordsMatch && newPassword !== currentPassword && !submitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      // Refresh user — server has now cleared `must_reset_password` so the
      // dialog will unmount on the next render.
      await reAuthenticate();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not rotate password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => { /* non-dismissible */ }}>
      <DialogContent
        showCloseButton={false}
        className="max-w-md sm:max-w-lg border-0 rounded-2xl p-0 overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        data-testid="force-password-reset-modal"
      >
        <div className="bg-gradient-to-br from-[#082c59] to-[#0a3a75] px-6 pt-6 pb-4 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-full bg-white/15 flex items-center justify-center">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <DialogHeader>
                <DialogTitle className="text-white text-lg font-semibold">Rotate your password</DialogTitle>
                <DialogDescription className="text-white/80 text-sm">
                  Security policy — this account was provisioned with a default password. Set a new one to continue.
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" data-testid="force-reset-error">
              {error}
            </div>
          )}

          <div>
            <Label htmlFor="frp-current" className="text-slate-700 text-sm">Current password</Label>
            <div className="relative mt-1">
              <Input
                id="frp-current"
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password"
                className="pr-10 h-11"
                autoFocus
                required
                data-testid="force-reset-current"
              />
              <button type="button" onClick={() => setShowCurrent(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <Label htmlFor="frp-new" className="text-slate-700 text-sm">New password</Label>
            <div className="relative mt-1">
              <Input
                id="frp-new"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Choose a strong password"
                className="pr-10 h-11"
                required
                data-testid="force-reset-new"
              />
              <button type="button" onClick={() => setShowNew(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <Label htmlFor="frp-confirm" className="text-slate-700 text-sm">Confirm new password</Label>
            <Input
              id="frp-confirm"
              type={showNew ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter the new password"
              className="mt-1 h-11"
              required
              data-testid="force-reset-confirm"
            />
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-xs text-red-600 mt-1">Passwords do not match.</p>
            )}
          </div>

          <ul className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-1.5" data-testid="force-reset-rules">
            {PASSWORD_RULES.map(rule => {
              const ok = rule.test(newPassword);
              return (
                <li key={rule.id} className="flex items-center gap-2 text-xs">
                  {ok
                    ? <Check className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                    : <X className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />}
                  <span className={ok ? 'text-emerald-700' : 'text-slate-500'}>{rule.label}</span>
                </li>
              );
            })}
            {newPassword.length > 0 && newPassword === currentPassword && (
              <li className="flex items-center gap-2 text-xs">
                <X className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                <span className="text-red-600">New password must differ from current</span>
              </li>
            )}
          </ul>

          <Button
            type="submit"
            disabled={!canSubmit}
            className="w-full h-11 bg-[#082c59] hover:bg-[#0a3a75] text-white font-medium rounded-xl disabled:opacity-60"
            data-testid="force-reset-submit"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Rotate password & continue'}
          </Button>

          <p className="text-[11px] text-slate-500 text-center pt-1">
            You will stay signed in. This dialog cannot be dismissed until you choose a new password.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
