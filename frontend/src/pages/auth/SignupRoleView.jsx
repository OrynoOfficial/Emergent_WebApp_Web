import { Button } from '@/components/ui/button';
import { User, Building2, ArrowLeft, Globe } from 'lucide-react';
import { FormModal, AUTH_VIEWS } from './AuthConstants';

export function SignupRoleView({ goBack, selectedRole, setSelectedRole, setCurrentView }) {
  return (
    <FormModal>
      <div className="flex items-center justify-between mb-4">
        <button onClick={goBack} className="flex items-center text-slate-600 hover:text-[#082c59] text-sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</button>
        <div className="flex items-center gap-1 text-xs text-slate-500"><Globe className="h-3 w-3" /><span>EN</span></div>
      </div>
      <div className="text-center mb-5">
        <img src="/images/logo.png" alt="Logo" className="h-12 w-auto mx-auto mb-2 object-contain" />
        <h1 className="text-xl font-bold text-slate-900">Create Account</h1>
        <p className="text-slate-500 text-sm">I want to sign up as a</p>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button onClick={() => setSelectedRole('customer')} className={`p-4 rounded-xl border-2 text-center transition-all hover:scale-[1.02] ${selectedRole === 'customer' ? 'border-[#082c59] bg-blue-50 shadow-md' : 'border-slate-200 hover:border-slate-300'}`}>
          <div className={`w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center ${selectedRole === 'customer' ? 'bg-[#082c59]' : 'bg-slate-100'}`}>
            <User className={`h-6 w-6 ${selectedRole === 'customer' ? 'text-white' : 'text-slate-500'}`} />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">Customer</h3>
          <p className="text-xs text-slate-500 mt-1">Book services</p>
        </button>
        <button onClick={() => setSelectedRole('operator')} className={`p-4 rounded-xl border-2 text-center transition-all hover:scale-[1.02] ${selectedRole === 'operator' ? 'border-[#082c59] bg-blue-50 shadow-md' : 'border-slate-200 hover:border-slate-300'}`}>
          <div className={`w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center ${selectedRole === 'operator' ? 'bg-[#082c59]' : 'bg-slate-100'}`}>
            <Building2 className={`h-6 w-6 ${selectedRole === 'operator' ? 'text-white' : 'text-slate-500'}`} />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">Operator</h3>
          <p className="text-xs text-slate-500 mt-1">Provide services</p>
        </button>
      </div>
      <Button onClick={() => setCurrentView(selectedRole === 'operator' ? AUTH_VIEWS.OPERATOR_CONTACT : AUTH_VIEWS.SIGNUP_FORM)} className="w-full h-11 bg-[#082c59] hover:bg-[#0a3a75] text-white font-medium rounded-xl">Continue</Button>
      <p className="text-center text-slate-600 mt-4 text-sm">
        Already have an account?{' '}
        <button onClick={() => setCurrentView(AUTH_VIEWS.LOGIN)} className="text-[#082c59] font-medium hover:underline">Login</button>
      </p>
    </FormModal>
  );
}
