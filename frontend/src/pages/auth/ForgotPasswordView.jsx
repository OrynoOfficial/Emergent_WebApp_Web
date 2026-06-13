/**
 * Forgot-password modal (customer-only self-service).
 *
 * Two channels per the user's spec (option 2c):
 *   • Email  → magic-link via Resend.
 *   • Phone  → 6-digit OTP entered inline.
 *
 * Flow:
 *   stage 'request' — pick channel + enter identifier → POST /forgot-password
 *   stage 'sent'    — confirmation card (email path) OR OTP entry form (phone)
 *   stage 'reset'   — new password + confirm → POST /reset-password
 *   stage 'done'    — success card with "Back to login" CTA
 *
 * The endpoint returns the reset-link / OTP back in the response body so
 * the agent / QA can complete the flow even when Resend is in sandbox
 * mode. In production we render them only as a fallback notice — never
 * the OTP itself in the success card.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Mail, Phone, ArrowLeft, Loader2, Eye, EyeOff, Lock, CheckCircle2, KeyRound, RotateCw,
} from 'lucide-react';
import { FormModal, AUTH_VIEWS } from './AuthConstants';
import api from '../../api/client';

const RESEND_COOLDOWN_SEC = 45;  // ← hide brute-force; mirrors AUTH_RESEND_RATE

export function ForgotPasswordView({ setCurrentView }) {
  const [stage, setStage] = useState('request');  // request → sent → reset → done
  const [method, setMethod] = useState('email');  // 'email' | 'phone'
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState(null);   // { reset_link?, otp?, dispatched }

  // ─── Resend OTP countdown ─────────────────────────────────────────
  // Re-arms whenever the OTP request succeeds. The button is disabled
  // until the countdown hits 0 so the user can't hammer SMS dispatch.
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const tickRef = useRef(null);

  useEffect(() => {
    if (cooldown <= 0) {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
      return;
    }
    tickRef.current = setInterval(() => {
      setCooldown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [cooldown]);

  const submitRequest = useCallback(async (e) => {
    e?.preventDefault();
    setError('');
    if (!identifier.trim()) {
      setError(`Please enter your ${method === 'email' ? 'email' : 'phone number'}.`);
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post('/auth/forgot-password', {
        method,
        identifier: identifier.trim(),
      });
      setInfo(data);
      // Email → user clicks the link in their inbox. We surface the link
      // here only as a sandbox fallback. Phone → continue inline.
      setStage(method === 'phone' ? 'reset' : 'sent');
      if (method === 'phone') setCooldown(RESEND_COOLDOWN_SEC);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(detail || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [method, identifier]);

  const resendOtp = useCallback(async () => {
    if (cooldown > 0 || resending) return;
    setError('');
    setResending(true);
    try {
      const { data } = await api.post('/auth/forgot-password', {
        method: 'phone',
        identifier: identifier.trim(),
      });
      // Keep the user's currently-typed OTP — they likely just want a
      // fresh code because the old one expired / never arrived. Surface
      // the new sandbox code if any so dev can re-enter it.
      setInfo(data);
      setOtp('');
      setCooldown(RESEND_COOLDOWN_SEC);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(detail || 'Could not resend code. Please try again in a moment.');
    } finally {
      setResending(false);
    }
  }, [cooldown, resending, identifier]);

  const submitReset = useCallback(async (e) => {
    e?.preventDefault();
    setError('');
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (method === 'phone' && otp.length !== 6) {
      setError('Enter the 6-digit code that was sent to your phone.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/reset-password', {
        method,
        token: method === 'phone' ? otp : (info?.reset_link?.split('token=')[1] || ''),
        identifier: method === 'phone' ? identifier.trim() : undefined,
        new_password: newPassword,
      });
      setStage('done');
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(detail || 'Could not reset password. The code may be invalid or expired.');
    } finally {
      setBusy(false);
    }
  }, [method, otp, info, identifier, newPassword, confirmPassword]);

  return (
    <FormModal>
      <button
        onClick={() => setCurrentView(AUTH_VIEWS.LOGIN)}
        className="flex items-center text-slate-600 hover:text-[#082c59] text-sm mb-4"
        data-testid="forgot-back-btn"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />Back to login
      </button>

      <div className="text-center mb-5">
        <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-[#082c59]/10 flex items-center justify-center">
          <KeyRound className="h-6 w-6 text-[#082c59]" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Reset your password</h1>
        <p className="text-slate-500 text-sm">
          {stage === 'request' && 'Choose how you want to recover access.'}
          {stage === 'sent' && 'Check your inbox for the reset link.'}
          {stage === 'reset' && 'Enter the code and pick a new password.'}
          {stage === 'done' && 'All set! You can sign in with your new password.'}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-600 text-white rounded-xl shadow" data-testid="forgot-error-alert">
          <p className="text-sm font-medium text-center">{error}</p>
        </div>
      )}

      {/* ─── stage: request ─────────────────────────────────────────── */}
      {stage === 'request' && (
        <form onSubmit={submitRequest} className="space-y-4">
          <div className="flex rounded-lg overflow-hidden border border-slate-200">
            <button type="button" onClick={() => { setMethod('email'); setIdentifier(''); }} className={`flex-1 py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 ${method === 'email' ? 'bg-[#082c59] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`} data-testid="forgot-method-email">
              <Mail className="h-4 w-4" />Email
            </button>
            <button type="button" onClick={() => { setMethod('phone'); setIdentifier(''); }} className={`flex-1 py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 ${method === 'phone' ? 'bg-[#082c59] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`} data-testid="forgot-method-phone">
              <Phone className="h-4 w-4" />Phone
            </button>
          </div>
          <div>
            <Label className="text-slate-700 text-sm">
              {method === 'email' ? 'Email Address' : 'Phone Number'}
            </Label>
            <div className="relative mt-1">
              {method === 'email'
                ? <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none z-10" />
                : <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none z-10" />}
              <Input
                type={method === 'email' ? 'email' : 'tel'}
                placeholder={method === 'email' ? 'your@email.com' : '+237 6XX XXX XXX'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="pl-10 h-11"
                autoFocus
                required
                data-testid="forgot-identifier-input"
              />
            </div>
          </div>
          <Button type="submit" disabled={busy || !identifier.trim()} className="w-full h-11 bg-[#082c59] hover:bg-[#0a3a75] text-white rounded-xl" data-testid="forgot-submit-btn">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" />
              : (method === 'email' ? 'Send reset link' : 'Send 6-digit code')}
          </Button>
        </form>
      )}

      {/* ─── stage: sent (email) ────────────────────────────────────── */}
      {stage === 'sent' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900">
            <p className="font-semibold mb-1 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />Reset link sent
            </p>
            <p>If an account exists for <strong>{identifier}</strong>, you&apos;ll receive an email with a one-time link. It expires in 30 minutes.</p>
            {info?.reset_link && (
              <p className="mt-3 text-xs text-emerald-700">
                Dev fallback — open this link directly:{' '}
                <a href={info.reset_link} className="underline font-mono break-all" data-testid="forgot-sandbox-link">
                  {info.reset_link}
                </a>
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full h-11"
            onClick={() => setCurrentView(AUTH_VIEWS.LOGIN)}
            data-testid="forgot-done-back-to-login"
          >
            Back to login
          </Button>
        </div>
      )}

      {/* ─── stage: reset (phone OTP entry + new password) ──────────── */}
      {stage === 'reset' && (
        <form onSubmit={submitReset} className="space-y-4">
          <div className="p-3 rounded-lg bg-sky-50 border border-sky-200 text-xs text-sky-900">
            We sent a 6-digit code to <strong>{identifier}</strong>.
            {info?.otp && (
              <span className="block mt-1 text-sky-700">
                Sandbox code: <span className="font-mono font-semibold" data-testid="forgot-sandbox-otp">{info.otp}</span>
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-slate-700 text-sm">Verification Code</Label>
              <button
                type="button"
                onClick={resendOtp}
                disabled={cooldown > 0 || resending}
                className="text-xs font-medium text-[#082c59] disabled:text-slate-400 disabled:cursor-not-allowed inline-flex items-center gap-1 hover:underline disabled:no-underline"
                data-testid="forgot-resend-otp-btn"
              >
                <RotateCw className={`h-3 w-3 ${resending ? 'animate-spin' : ''}`} />
                {cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : (resending ? 'Sending…' : 'Resend code')}
              </button>
            </div>
            <Input
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="mt-1 h-11 text-center text-lg font-mono tracking-widest"
              autoFocus
              required
              data-testid="forgot-otp-input"
            />
          </div>

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
                required
                data-testid="forgot-new-password-input"
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
                data-testid="forgot-confirm-password-input"
              />
            </div>
          </div>

          <Button type="submit" disabled={busy} className="w-full h-11 bg-[#082c59] hover:bg-[#0a3a75] text-white rounded-xl" data-testid="forgot-reset-submit-btn">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Reset password'}
          </Button>
        </form>
      )}

      {/* ─── stage: done ────────────────────────────────────────────── */}
      {stage === 'done' && (
        <div className="space-y-4">
          <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto mb-2" />
            <p className="font-semibold text-emerald-900">Password updated</p>
            <p className="text-sm text-emerald-800 mt-1">You can now sign in with your new password.</p>
          </div>
          <Button
            type="button"
            className="w-full h-11 bg-[#082c59] hover:bg-[#0a3a75] text-white rounded-xl"
            onClick={() => setCurrentView(AUTH_VIEWS.LOGIN)}
            data-testid="forgot-done-go-login"
          >
            Sign in
          </Button>
        </div>
      )}
    </FormModal>
  );
}
