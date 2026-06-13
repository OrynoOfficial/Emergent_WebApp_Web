/**
 * Two-step login.
 *
 * Step 1 — user types email OR phone and clicks "Continue". We hit
 *          `/auth/check-account` to discover whether an account exists.
 *          • If yes → reveal the password field (step 2).
 *          • If no  → show an inline message + Sign-up CTA.
 *
 * Step 2 — password field appears; submitting hits the standard login.
 *          A small "Edit" button next to the identifier lets the user
 *          jump back to step 1 without losing the rest of the form.
 *
 * Step 1 input + step 2 password use distinct submit handlers so each
 * Enter-key press does the right thing (continue vs sign-in).
 */
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Mail, Lock, Phone, Loader2, ArrowLeft, Globe, Pencil } from 'lucide-react';
import { FormModal, AUTH_VIEWS } from './AuthConstants';
import api from '../../api/client';

export function LoginView({
  goBack, error, setError,
  loginMethod, setLoginMethod,
  loginIdentifier, setLoginIdentifier,
  loginPassword, setLoginPassword,
  showPassword, setShowPassword,
  isLoading, handleLogin, setCurrentView,
}) {
  const [step, setStep] = useState(1);            // 1 = identifier · 2 = password
  const [checking, setChecking] = useState(false);
  const [accountInfo, setAccountInfo] = useState(null);  // {exists, role, status}

  const editIdentifier = useCallback(() => {
    setStep(1);
    setAccountInfo(null);
    setLoginPassword('');
    setError && setError('');
  }, [setLoginPassword, setError]);

  const continueToPassword = useCallback(async (e) => {
    e?.preventDefault();
    setError && setError('');
    if (!loginIdentifier?.trim()) {
      setError && setError(`Please enter your ${loginMethod === 'email' ? 'email' : 'phone number'}.`);
      return;
    }
    setChecking(true);
    try {
      const { data } = await api.post('/auth/check-account', {
        method: loginMethod,
        identifier: loginIdentifier.trim(),
      });
      setAccountInfo(data);
      if (data?.exists) {
        if (data.status === 'pending_verification') {
          setError && setError('Please verify your account via the invitation email before signing in.');
          return;
        }
        if (data.status && data.status !== 'active') {
          setError && setError('This account is not active. Contact support.');
          return;
        }
        setStep(2);
      } else {
        setError && setError(`No account found for that ${loginMethod}. You can create one in a moment.`);
      }
    } catch (err) {
      // Network or 429 — let the user retry with a clear message.
      const msg = err?.response?.data?.detail || 'Network error. Please try again.';
      setError && setError(msg);
    } finally {
      setChecking(false);
    }
  }, [loginIdentifier, loginMethod, setError]);

  const switchMethod = (m) => {
    setLoginMethod(m);
    setLoginIdentifier('');
    setLoginPassword('');
    setStep(1);
    setAccountInfo(null);
    setError && setError('');
  };

  return (
    <FormModal>
      <div className="flex items-center justify-between mb-4">
        <button onClick={goBack} className="flex items-center text-slate-600 hover:text-[#082c59] text-sm" data-testid="login-back-btn">
          <ArrowLeft className="h-4 w-4 mr-1" />Back
        </button>
        <div className="flex items-center gap-1 text-xs text-slate-500"><Globe className="h-3 w-3" /><span>EN</span></div>
      </div>

      <div className="text-center mb-5">
        <img src="/images/logo.png" alt="Oryno" className="h-12 w-auto mx-auto mb-2 object-contain" />
        <h1 className="text-xl font-bold text-slate-900">Welcome Back</h1>
        <p className="text-slate-500 text-sm">
          {step === 1 ? 'Login to your account' : 'Enter your password to continue'}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-600 text-white rounded-xl animate-pulse shadow-lg" data-testid="login-error-alert">
          <p className="text-sm font-medium text-center">{error}</p>
          {accountInfo?.exists === false && step === 1 && (
            <button
              type="button"
              onClick={() => setCurrentView(AUTH_VIEWS.SIGNUP_ROLE)}
              className="mt-2 w-full text-sm font-semibold underline hover:no-underline"
              data-testid="login-signup-from-error"
            >
              Create a new account →
            </button>
          )}
        </div>
      )}

      {step === 1 ? (
        <form onSubmit={continueToPassword} className="space-y-4">
          <div className="flex rounded-lg overflow-hidden border border-slate-200">
            <button type="button" onClick={() => switchMethod('email')} className={`flex-1 py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${loginMethod === 'email' ? 'bg-[#082c59] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`} data-testid="login-method-email">
              <Mail className="h-4 w-4" />Email
            </button>
            <button type="button" onClick={() => switchMethod('phone')} className={`flex-1 py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${loginMethod === 'phone' ? 'bg-[#082c59] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`} data-testid="login-method-phone">
              <Phone className="h-4 w-4" />Phone
            </button>
          </div>

          <div>
            <Label htmlFor="login-identifier" className="text-slate-700 text-sm">
              {loginMethod === 'email' ? 'Email Address' : 'Phone Number'}
            </Label>
            <div className="relative mt-1">
              {loginMethod === 'email'
                ? <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none z-10" />
                : <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none z-10" />}
              <Input
                id="login-identifier"
                type={loginMethod === 'email' ? 'email' : 'tel'}
                placeholder={loginMethod === 'email' ? 'your@email.com' : '+237 6XX XXX XXX'}
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                className="pl-10 h-11 bg-white border-slate-200 focus:bg-white focus:border-[#082c59] focus:ring-2 focus:ring-[#082c59]/20 transition-all caret-[#082c59]"
                autoComplete={loginMethod === 'email' ? 'email' : 'tel'}
                autoFocus
                required
                data-testid="login-identifier-input"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={checking || !loginIdentifier?.trim()}
            className="w-full h-11 bg-[#082c59] hover:bg-[#0a3a75] text-white font-medium rounded-xl"
            data-testid="login-continue-btn"
          >
            {checking ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Continue'}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleLogin} className="space-y-4">
          {/* identifier echo with edit affordance */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
            <div className="flex items-center gap-2 min-w-0">
              {loginMethod === 'email'
                ? <Mail className="h-4 w-4 text-slate-500 flex-shrink-0" />
                : <Phone className="h-4 w-4 text-slate-500 flex-shrink-0" />}
              <span className="text-sm text-slate-800 truncate" data-testid="login-identifier-echo">
                {loginIdentifier}
              </span>
            </div>
            <button
              type="button"
              onClick={editIdentifier}
              className="flex items-center gap-1 text-xs text-[#082c59] hover:underline flex-shrink-0"
              data-testid="login-edit-identifier"
            >
              <Pencil className="h-3 w-3" />Edit
            </button>
          </div>

          <div>
            <Label htmlFor="login-password" className="text-slate-700 text-sm">Password</Label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none z-10" />
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="pl-10 pr-10 h-11 bg-white border-slate-200 focus:bg-white focus:border-[#082c59] focus:ring-2 focus:ring-[#082c59]/20 transition-all caret-[#082c59]"
                autoComplete="current-password"
                autoFocus
                required
                data-testid="login-password-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                data-testid="login-toggle-password-visibility"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="mt-2 text-right">
              <button
                type="button"
                onClick={() => setCurrentView(AUTH_VIEWS.FORGOT_PASSWORD)}
                className="text-xs text-[#082c59] hover:underline"
                data-testid="login-forgot-password-link"
              >
                Forgot password?
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 bg-[#082c59] hover:bg-[#0a3a75] text-white font-medium rounded-xl"
            data-testid="login-submit-btn"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Login'}
          </Button>
        </form>
      )}

      <p className="text-center text-slate-600 mt-4 text-sm">
        Don&apos;t have an account?{' '}
        <button
          onClick={() => setCurrentView(AUTH_VIEWS.SIGNUP_ROLE)}
          className="text-[#082c59] font-medium hover:underline"
          data-testid="login-go-signup"
        >
          Sign up
        </button>
      </p>
    </FormModal>
  );
}
