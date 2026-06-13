import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, EyeOff, Mail, Lock, User, Phone, Loader2, ArrowLeft, Globe } from 'lucide-react';
import { FormModal, AUTH_VIEWS, MARKETING_LINKS } from './AuthConstants';

export function SignupFormView({ goBack, error, fullName, setFullName, contactMethod, setContactMethod, registerEmail, setRegisterEmail, registerPhone, setRegisterPhone, registerPassword, setRegisterPassword, showPassword, setShowPassword, confirmPassword, setConfirmPassword, showConfirmPassword, setShowConfirmPassword, acceptTerms, setAcceptTerms, isLoading, handleRegister, setCurrentView }) {
  return (
    <FormModal>
      <div className="flex items-center justify-between mb-4">
        <button onClick={goBack} className="flex items-center text-slate-600 hover:text-[#082c59] text-sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</button>
        <div className="flex items-center gap-1 text-xs text-slate-500"><Globe className="h-3 w-3" /><span>EN</span></div>
      </div>
      <div className="text-center mb-4">
        <h1 className="text-xl font-bold text-slate-900">Create Account</h1>
        <p className="text-slate-500 text-sm">Fill in your details</p>
      </div>
      {error && (
        <div className="mb-4 p-3 bg-red-600 text-white rounded-xl animate-pulse shadow-lg" data-testid="signup-error-alert">
          <p className="text-sm font-medium text-center">{error}</p>
        </div>
      )}
      <form onSubmit={handleRegister} className="space-y-3">
        <div>
          <Label htmlFor="fullName" className="text-slate-700 text-sm">Full Name</Label>
          <div className="relative mt-1">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input id="fullName" type="text" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} className="pl-10 h-10 bg-slate-50 border-slate-200" required />
          </div>
        </div>
        <div>
          <Label className="text-slate-700 text-sm">Contact Method</Label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <button type="button" onClick={() => setContactMethod('email')} className={`flex items-center justify-center gap-2 p-2 rounded-lg border-2 transition-all text-sm ${contactMethod === 'email' ? 'bg-[#082c59] text-white border-[#082c59]' : 'border-slate-200 text-slate-700 hover:border-slate-300'}`}>
              <Mail className="h-4 w-4" /><span className="font-medium">Email</span>
            </button>
            <button type="button" onClick={() => setContactMethod('phone')} className={`flex items-center justify-center gap-2 p-2 rounded-lg border-2 transition-all text-sm ${contactMethod === 'phone' ? 'bg-[#082c59] text-white border-[#082c59]' : 'border-slate-200 text-slate-700 hover:border-slate-300'}`}>
              <Phone className="h-4 w-4" /><span className="font-medium">Phone</span>
            </button>
          </div>
        </div>
        {contactMethod === 'email' ? (
          <div>
            <Label htmlFor="register-email" className="text-slate-700 text-sm">Email Address</Label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input id="register-email" type="email" placeholder="your@email.com" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} className="pl-10 h-10 bg-slate-50 border-slate-200" required />
            </div>
          </div>
        ) : (
          <div>
            <Label htmlFor="register-phone" className="text-slate-700 text-sm">Phone Number</Label>
            <div className="relative mt-1">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input id="register-phone" type="tel" placeholder="+237 6XX XXX XXX" value={registerPhone} onChange={(e) => setRegisterPhone(e.target.value)} className="pl-10 h-10 bg-slate-50 border-slate-200" required />
            </div>
          </div>
        )}
        <div>
          <Label htmlFor="register-password" className="text-slate-700 text-sm">Password</Label>
          <div className="relative mt-1">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input id="register-password" type={showPassword ? 'text' : 'password'} placeholder="Create a password" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} className="pl-10 pr-10 h-10 bg-slate-50 border-slate-200" required />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div>
          <Label htmlFor="confirmPassword" className="text-slate-700 text-sm">Confirm Password</Label>
          <div className="relative mt-1">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input id="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} placeholder="Confirm your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 pr-10 h-10 bg-slate-50 border-slate-200" required />
            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Checkbox id="acceptTerms" checked={acceptTerms} onCheckedChange={(checked) => setAcceptTerms(checked)} className="mt-0.5" />
          <Label htmlFor="acceptTerms" className="text-xs text-slate-600 cursor-pointer">
            I agree to the <a href={MARKETING_LINKS.TERMS} target="_blank" rel="noopener noreferrer" className="text-[#082c59] hover:underline">Terms</a> and <a href={MARKETING_LINKS.PRIVACY} target="_blank" rel="noopener noreferrer" className="text-[#082c59] hover:underline">Privacy Policy</a>
          </Label>
        </div>
        <Button type="submit" disabled={isLoading} className="w-full h-11 bg-[#082c59] hover:bg-[#0a3a75] text-white font-medium rounded-xl">
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Create Account'}
        </Button>
      </form>
      <p className="text-center text-slate-600 mt-3 text-sm">
        Already have an account?{' '}
        <button onClick={() => setCurrentView(AUTH_VIEWS.LOGIN)} className="text-[#082c59] font-medium hover:underline">Login</button>
      </p>
    </FormModal>
  );
}
