import { Button } from '@/components/ui/button';
import { Lock, User, Home } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FormModal, AUTH_VIEWS, MARKETING_LINKS } from './AuthConstants';

export function WelcomeView({ setCurrentView }) {
  const { t } = useTranslation();
  return (
    <FormModal>
      <div className="text-center mb-6">
        <img src="/images/logo.png" alt="Oryno" className="h-16 w-auto mx-auto mb-3 object-contain" />
        <h1 className="text-2xl font-bold text-slate-900">{t('common.app_name')}</h1>
        <p className="text-slate-500 text-sm">{t('auth.welcome_hub_tagline')}</p>
      </div>
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-slate-900">{t('auth.welcome_get_started')}</h2>
      </div>
      <div className="space-y-3">
        <Button
          onClick={() => setCurrentView(AUTH_VIEWS.LOGIN)}
          className="w-full h-12 bg-[#082c59] hover:bg-[#0a3a75] text-white font-medium rounded-xl"
          data-testid="welcome-login-btn"
        >
          <Lock className="mr-2 h-5 w-5" />{t('auth.welcome_login_cta')}
        </Button>
        <Button
          onClick={() => setCurrentView(AUTH_VIEWS.SIGNUP_ROLE)}
          variant="outline"
          className="w-full h-12 border-2 border-[#082c59] text-[#082c59] hover:bg-[#082c59]/5 font-medium rounded-xl"
          data-testid="welcome-signup-btn"
        >
          <User className="mr-2 h-5 w-5" />{t('auth.welcome_signup_cta')}
        </Button>
      </div>
      <p className="text-xs text-slate-500 mt-6 text-center">
        {t('auth.welcome_terms_prefix')}{' '}
        <a
          href={MARKETING_LINKS.TERMS}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#082c59] hover:underline"
          data-testid="welcome-terms-link"
        >
          {t('auth.welcome_terms_link')}
        </a>
        {' '}{t('auth.welcome_and')}{' '}
        <a
          href={MARKETING_LINKS.PRIVACY}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#082c59] hover:underline"
          data-testid="welcome-privacy-link"
        >
          {t('auth.welcome_privacy_link')}
        </a>
      </p>
      <a
        href={MARKETING_LINKS.HOME}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 text-slate-500 hover:text-[#082c59] mt-4 text-sm"
        data-testid="welcome-home-link"
      >
        <Home className="h-4 w-4" />{t('auth.welcome_home_link')}
      </a>
    </FormModal>
  );
}
