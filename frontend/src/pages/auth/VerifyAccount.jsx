import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/api/client';

/**
 * /verify-account?token=...
 * Public landing page that confirms an invited operator-owner / staff account.
 * - GETs metadata from /api/auth/verify-account/{token}
 * - Renders a password form (or just a "Confirm" button when has_temp_password)
 * - POSTs the new password to /api/auth/verify-account
 */
export default function VerifyAccount() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token) { setError('Missing invitation token.'); setLoading(false); return; }
      try {
        const res = await api.get(`/auth/verify-account/${token}`);
        if (!cancelled) setInfo(res.data);
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.detail || 'This invitation link is no longer valid.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token]);

  const hasTemp = info?.has_temp_password;
  const needsPassword = !hasTemp;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (needsPassword) {
      if (!password || password.length < 8) {
        toast.error('Password must be at least 8 characters');
        return;
      }
      if (password !== confirm) {
        toast.error('Passwords do not match');
        return;
      }
    }
    setSubmitting(true);
    try {
      const body = { token, password: needsPassword ? password : (password || undefined) };
      await api.post(`/auth/verify-account`, body);
      setDone(true);
      toast.success('Account confirmed — you can now sign in.');
      setTimeout(() => navigate('/login'), 1800);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not confirm the account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md border-slate-200 shadow-lg">
        <div className="bg-[#082c59] text-white px-6 py-5 rounded-t-lg">
          <h1 className="text-xl font-bold">Confirm your Oryno account</h1>
          <p className="text-xs text-cyan-200/80 mt-1">
            {info?.operator_name ? `Welcome to ${info.operator_name}.` : 'Set up your access in a few seconds.'}
          </p>
        </div>
        <CardContent className="p-6">
          {loading && (
            <div className="flex items-center gap-2 text-slate-500 py-10 justify-center" data-testid="verify-loading">
              <Loader2 className="w-4 h-4 animate-spin" /> Checking your invitation…
            </div>
          )}

          {!loading && error && (
            <div className="text-center py-6" data-testid="verify-error">
              <ShieldAlert className="w-10 h-10 mx-auto text-red-500 mb-2" />
              <p className="text-slate-800 font-medium">Invitation problem</p>
              <p className="text-sm text-slate-500 mt-1">{error}</p>
              <Button className="mt-5 bg-[#082c59]" onClick={() => navigate('/login')}>Back to login</Button>
            </div>
          )}

          {!loading && !error && done && (
            <div className="text-center py-6" data-testid="verify-success">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
              <p className="text-slate-800 font-medium">All set!</p>
              <p className="text-sm text-slate-500 mt-1">Redirecting you to login…</p>
            </div>
          )}

          {!loading && !error && !done && info && (
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="verify-form">
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm">
                <p className="text-slate-500 text-xs uppercase tracking-wider">Email</p>
                <p className="text-slate-800 font-medium" data-testid="verify-email">{info.email}</p>
                {info.full_name && <p className="text-xs text-slate-500 mt-1">Account holder: <span className="font-medium text-slate-700">{info.full_name}</span></p>}
              </div>
              {needsPassword ? (
                <>
                  <div>
                    <Label className="text-xs">Create a password *</Label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      data-testid="verify-password-input"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Confirm password *</Label>
                    <Input
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      data-testid="verify-confirm-input"
                    />
                  </div>
                </>
              ) : (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5 text-sm text-emerald-800">
                  Your temporary password is already set. Click below to activate your account; you can change the password from your profile after signing in.
                </div>
              )}
              <Button
                type="submit"
                className="w-full bg-[#082c59] hover:bg-[#0a3a75] h-11"
                disabled={submitting}
                data-testid="verify-submit-btn"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {needsPassword ? 'Activate & set password' : 'Activate my account'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
