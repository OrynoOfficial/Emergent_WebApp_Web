import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Lock, User, Home } from 'lucide-react';
import { FormModal, AUTH_VIEWS } from './AuthConstants';

export function WelcomeView({ setCurrentView }) {
  return (
    <FormModal>
      <div className="text-center mb-6">
        <img src="/images/logo.png" alt="Logo" className="h-16 w-auto mx-auto mb-3 object-contain" />
        <h1 className="text-2xl font-bold text-slate-900">Oryno</h1>
        <p className="text-slate-500 text-sm">Your Everyday Services Hub</p>
      </div>
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-slate-900">Welcome! Let&apos;s get started</h2>
      </div>
      <div className="space-y-3">
        <Button onClick={() => setCurrentView(AUTH_VIEWS.LOGIN)} className="w-full h-12 bg-[#082c59] hover:bg-[#0a3a75] text-white font-medium rounded-xl">
          <Lock className="mr-2 h-5 w-5" />Login to Your Account
        </Button>
        <Button onClick={() => setCurrentView(AUTH_VIEWS.SIGNUP_ROLE)} variant="outline" className="w-full h-12 border-2 border-[#082c59] text-[#082c59] hover:bg-[#082c59]/5 font-medium rounded-xl">
          <User className="mr-2 h-5 w-5" />Create New Account
        </Button>
      </div>
      <p className="text-xs text-slate-500 mt-6 text-center">
        By continuing, you agree to our{' '}
        <Link to="/terms" className="text-[#082c59] hover:underline">Terms of Service</Link>
        {' '}and{' '}
        <Link to="/privacy" className="text-[#082c59] hover:underline">Privacy Policy</Link>
      </p>
      <Link to="/" className="flex items-center justify-center gap-2 text-slate-500 hover:text-[#082c59] mt-4 text-sm">
        <Home className="h-4 w-4" />Return to Homepage
      </Link>
    </FormModal>
  );
}
