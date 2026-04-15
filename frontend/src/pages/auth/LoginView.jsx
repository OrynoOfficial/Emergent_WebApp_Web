import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Mail, Lock, Phone, Loader2, ArrowLeft, Globe } from 'lucide-react';
import { FormModal, AUTH_VIEWS } from './AuthConstants';

export function LoginView({ goBack, error, loginMethod, setLoginMethod, loginIdentifier, setLoginIdentifier, loginPassword, setLoginPassword, showPassword, setShowPassword, isLoading, handleLogin, setCurrentView }) {
  return (
    <FormModal>
      <div className="flex items-center justify-between mb-4">
        <button onClick={goBack} className="flex items-center text-slate-600 hover:text-[#082c59] text-sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</button>
        <div className="flex items-center gap-1 text-xs text-slate-500"><Globe className="h-3 w-3" /><span>EN</span></div>
      </div>
      <div className="text-center mb-5">
        <img src="/images/logo.png" alt="Logo" className="h-12 w-auto mx-auto mb-2 object-contain" />
        <h1 className="text-xl font-bold text-slate-900">Welcome Back</h1>
        <p className="text-slate-500 text-sm">Login to your account</p>
      </div>
      {error && (
        <div className="mb-4 p-3 bg-red-600 text-white rounded-xl animate-pulse shadow-lg" data-testid="login-error-alert">
          <p className="text-sm font-medium text-center">{error}</p>
        </div>
      )}
      <form onSubmit={handleLogin} className="space-y-4">
        <div className="flex rounded-lg overflow-hidden border border-slate-200">
          <button type="button" onClick={() => { setLoginMethod('email'); setLoginIdentifier(''); }} className={`flex-1 py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${loginMethod === 'email' ? 'bg-[#082c59] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
            <Mail className="h-4 w-4" />Email
          </button>
          <button type="button" onClick={() => { setLoginMethod('phone'); setLoginIdentifier(''); }} className={`flex-1 py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${loginMethod === 'phone' ? 'bg-[#082c59] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
            <Phone className="h-4 w-4" />Phone
          </button>
        </div>
        <div>
          <Label htmlFor="login-identifier" className="text-slate-700 text-sm">{loginMethod === 'email' ? 'Email Address' : 'Phone Number'}</Label>
          <div className="relative mt-1">
            {loginMethod === 'email' ? <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none z-10" /> : <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none z-10" />}
            <Input id="login-identifier" type={loginMethod === 'email' ? 'email' : 'tel'} placeholder={loginMethod === 'email' ? 'your@email.com' : '+237 6XX XXX XXX'} value={loginIdentifier} onChange={(e) => setLoginIdentifier(e.target.value)} className="pl-10 h-11 bg-white border-slate-200 focus:bg-white focus:border-[#082c59] focus:ring-2 focus:ring-[#082c59]/20 transition-all caret-[#082c59]" autoComplete={loginMethod === 'email' ? 'email' : 'tel'} required />
          </div>
        </div>
        <div>
          <Label htmlFor="login-password" className="text-slate-700 text-sm">Password</Label>
          <div className="relative mt-1">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none z-10" />
            <Input id="login-password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="pl-10 pr-10 h-11 bg-white border-slate-200 focus:bg-white focus:border-[#082c59] focus:ring-2 focus:ring-[#082c59]/20 transition-all caret-[#082c59]" autoComplete="current-password" required />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <Button type="submit" disabled={isLoading} className="w-full h-11 bg-[#082c59] hover:bg-[#0a3a75] text-white font-medium rounded-xl">
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Login'}
        </Button>
      </form>
      <p className="text-center text-slate-600 mt-4 text-sm">
        Don&apos;t have an account?{' '}
        <button onClick={() => setCurrentView(AUTH_VIEWS.SIGNUP_ROLE)} className="text-[#082c59] font-medium hover:underline">Sign up</button>
      </p>
    </FormModal>
  );
}
