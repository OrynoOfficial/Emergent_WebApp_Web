import { Button } from '@/components/ui/button';
import { User, Building2, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FormModal, AUTH_VIEWS } from './AuthConstants';

export function SignupRoleView({ goBack, selectedRole, setSelectedRole, setCurrentView }) {
  const { t } = useTranslation();
  return (
    <FormModal>
      <div className="flex items-center justify-between mb-4">
        <button onClick={goBack} className="flex items-center text-slate-600 hover:text-[#082c59] text-sm">
          <ArrowLeft className="h-4 w-4 mr-1" />{t('common.back')}
        </button>
      </div>
      <div className="text-center mb-5">
        <img src="/images/logo.png" alt="Logo" className="h-12 w-auto mx-auto mb-2 object-contain" />
        <h1 className="text-xl font-bold text-slate-900">{t('auth.signup_title')}</h1>
        <p className="text-slate-500 text-sm">{t('auth.signup_role_subtitle')}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => setSelectedRole('customer')}
          className={`p-4 rounded-xl border-2 text-center transition-all hover:scale-[1.02] ${selectedRole === 'customer' ? 'border-[#082c59] bg-blue-50 shadow-md' : 'border-slate-200 hover:border-slate-300'}`}
          data-testid="signup-role-customer"
        >
          <div className={`w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center ${selectedRole === 'customer' ? 'bg-[#082c59]' : 'bg-slate-100'}`}>
            <User className={`h-6 w-6 ${selectedRole === 'customer' ? 'text-white' : 'text-slate-500'}`} />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">{t('auth.role_customer')}</h3>
          <p className="text-xs text-slate-500 mt-1">{t('auth.signup_role_customer_desc')}</p>
        </button>
        <button
          onClick={() => setSelectedRole('operator')}
          className={`p-4 rounded-xl border-2 text-center transition-all hover:scale-[1.02] ${selectedRole === 'operator' ? 'border-[#082c59] bg-blue-50 shadow-md' : 'border-slate-200 hover:border-slate-300'}`}
          data-testid="signup-role-operator"
        >
          <div className={`w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center ${selectedRole === 'operator' ? 'bg-[#082c59]' : 'bg-slate-100'}`}>
            <Building2 className={`h-6 w-6 ${selectedRole === 'operator' ? 'text-white' : 'text-slate-500'}`} />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">{t('auth.role_operator')}</h3>
          <p className="text-xs text-slate-500 mt-1">{t('auth.signup_role_operator_desc')}</p>
        </button>
      </div>
      <Button
        onClick={() => setCurrentView(selectedRole === 'operator' ? AUTH_VIEWS.OPERATOR_CONTACT : AUTH_VIEWS.SIGNUP_FORM)}
        className="w-full h-11 bg-[#082c59] hover:bg-[#0a3a75] text-white font-medium rounded-xl"
        data-testid="signup-role-continue"
      >
        {t('common.continue')}
      </Button>
      <p className="text-center text-slate-600 mt-4 text-sm">
        {t('auth.signup_have_account')}{' '}
        <button onClick={() => setCurrentView(AUTH_VIEWS.LOGIN)} className="text-[#082c59] font-medium hover:underline">
          {t('auth.signup_login_link')}
        </button>
      </p>
    </FormModal>
  );
}
