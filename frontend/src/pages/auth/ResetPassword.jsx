/**
 * Landing page for the email magic-link reset flow.
 *
 * URL shape: /reset-password?token=<hex>
 *
 * On mount we surface a small form (new password + confirm) that POSTs
 * to /api/auth/reset-password. On success we redirect to /login with a
 * toast hint. On failure we surface the error inline. The form is
 * intentionally identical in look-and-feel to the in-modal "phone OTP"
 * stage of ForgotPasswordView so the user feels like one flow.
 */
import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Lock, KeyRound, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../api/client';
import { PageTitle } from '../../components/shared/PageTitle';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (!token) setError('Missing or invalid reset token.');
  }, [token]);

  const submit = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { token, new_password: newPassword, method: 'email' });
      setDone(true);
      toast.success('Password updated. You can now sign in.');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not reset password. The link may be expired.');
    } finally {
      setBusy(false);
    }
  }, [token, newPassword, confirmPassword]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 to-slate-200">
      <PageTitle title="Reset Password" />
      <Card className="w-full max-w-md bg-white shadow-2xl border-0 rounded-2xl overflow-hidden">
        <CardContent className="p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-[#082c59]/10 flex items-center justify-center">
              <KeyRound className="h-6 w-6 text-[#082c59]" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Choose a new password</h1>
            <p className="text-slate-500 text-sm">Pick something you haven&apos;t used before.</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-600 text-white rounded-xl text-sm font-medium text-center" data-testid="reset-error-alert">
              {error}
            </div>
          )}

          {done ? (
            <div className="space-y-4">
              <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto mb-2" />
                <p className="font-semibold text-emerald-900">Password updated</p>
              </div>
              <Button
                onClick={() => navigate('/login')}
                className="w-full h-11 bg-[#082c59] hover:bg-[#0a3a75] text-white rounded-xl"
                data-testid="reset-go-login"
              >
                Sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label className="text-slate-700 text-sm">New Password</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none z-10" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Minimum 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10 pr-10 h-11"
                    autoFocus
                    required
                    data-testid="reset-new-password-input"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <Label className="text-slate-700 text-sm">Confirm Password</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none z-10" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Repeat your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 h-11"
                    required
                    data-testid="reset-confirm-password-input"
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={busy || !token}
                className="w-full h-11 bg-[#082c59] hover:bg-[#0a3a75] text-white rounded-xl"
                data-testid="reset-submit-btn"
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Reset password'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
