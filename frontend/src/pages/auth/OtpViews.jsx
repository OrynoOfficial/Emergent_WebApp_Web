import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowLeft, Mail, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useTranslation } from 'react-i18next';
import { FormModal, AUTH_VIEWS, MARKETING_LINKS } from './AuthConstants';

export function OperatorContactView({ goBack, setSelectedRole, setCurrentView }) {
  const { t } = useTranslation();
  return (
    <FormModal>
      <div className="flex items-center justify-between mb-4">
        <button onClick={goBack} className="flex items-center text-slate-600 hover:text-[#082c59] text-sm">
          <ArrowLeft className="h-4 w-4 mr-1" />{t('common.back')}
        </button>
      </div>
      <div className="text-center mb-4">
        <img src="/images/logo.png" alt="Oryno" className="h-12 w-auto mx-auto mb-2 object-contain" />
        <h1 className="text-xl font-bold text-slate-900">{t('auth.operator_signup_title')}</h1>
      </div>
      <div className="bg-slate-50 rounded-xl p-5 mb-4">
        <p className="text-slate-600 text-sm mb-4">{t('auth.operator_signup_intro')}</p>
        <Button
          onClick={() => window.open(`${MARKETING_LINKS.CONTACT}?type=operator`, '_blank', 'noopener,noreferrer')}
          className="w-full h-11 bg-[#082c59] hover:bg-[#0a3a75] text-white font-medium rounded-xl"
          data-testid="operator-contact-form-btn"
        >
          <Mail className="mr-2 h-4 w-4" />{t('auth.operator_signup_cta')}
        </Button>
        <button
          onClick={() => { setSelectedRole('customer'); setCurrentView(AUTH_VIEWS.SIGNUP_FORM); }}
          className="w-full text-center text-[#082c59] hover:underline mt-3 text-sm"
        >
          {t('auth.operator_signup_back_customer')}
        </button>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
        <h3 className="font-semibold text-amber-800 text-sm mb-1">{t('auth.operator_signup_expect_title')}</h3>
        <p className="text-xs text-amber-700">{t('auth.operator_signup_expect_desc')}</p>
      </div>
    </FormModal>
  );
}

export function PhoneOtpView({
  error, isLoading, otpVerified, otpVerifyMessage, phoneOtpValue, setPhoneOtpValue,
  phoneOtpCountdown, phoneOtpSending, pendingRegistration, verifyPhoneOTP,
  sendPhoneOTP, setCurrentView, setError,
}) {
  const { t } = useTranslation();
  return (
    <FormModal>
      {otpVerified ? (
        <div className="text-center py-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center animate-[scale-in_0.3s_ease-out]">
            <CheckCircle className="w-9 h-9 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-green-700 mb-2">{t('auth.phone_otp_verified')}</h2>
          <p className="text-slate-600 text-sm">{otpVerifyMessage}</p>
          {otpVerifyMessage.includes('activated') && <p className="text-xs text-slate-400 mt-3">{t('auth.phone_otp_redirecting_login')}</p>}
        </div>
      ) : (
        <>
          <div className="text-center mb-5">
            <img src="/images/logo.png" alt="Logo" className="h-12 w-auto mx-auto mb-3 object-contain" />
            <h2 className="text-xl font-bold text-slate-900">{t('auth.phone_otp_title')}</h2>
            <p className="text-slate-600 text-sm mt-1">
              {t('auth.phone_otp_desc')}<br />
              <span className="font-medium text-[#082c59]">{pendingRegistration?.phone}</span>
            </p>
          </div>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-red-700">{error}</p>
                  <div className="flex gap-3 mt-2">
                    <button onClick={() => { sendPhoneOTP(pendingRegistration?.phone); setError(''); setPhoneOtpValue(''); }} disabled={phoneOtpSending} className="flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium">
                      <RefreshCw className="w-3 h-3" /> {t('auth.phone_otp_resend_code')}
                    </button>
                    <button onClick={() => { setCurrentView(AUTH_VIEWS.SIGNUP_FORM); setPhoneOtpValue(''); setError(''); }} className="flex items-center gap-1 text-xs text-slate-600 hover:underline font-medium">
                      <ArrowLeft className="w-3 h-3" /> {t('auth.phone_otp_edit_info')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-center mb-5">
            <InputOTP value={phoneOtpValue} onChange={setPhoneOtpValue} maxLength={6}>
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((index) => <InputOTPSlot key={index} index={index} className="w-10 h-12 text-lg bg-slate-50" />)}
              </InputOTPGroup>
            </InputOTP>
          </div>
          {phoneOtpCountdown > 0 && <p className="text-center text-sm text-slate-500 mb-4">{t('auth.phone_otp_code_expires_in')} {Math.floor(phoneOtpCountdown / 60)}:{String(phoneOtpCountdown % 60).padStart(2, '0')}</p>}
          <Button onClick={verifyPhoneOTP} disabled={isLoading || phoneOtpValue.length !== 6} className="w-full h-11 bg-[#082c59] hover:bg-[#0a3a75] text-white font-medium rounded-xl" data-testid="verify-phone-otp-btn">
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : t('auth.phone_otp_verify_activate')}
          </Button>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
            <button onClick={() => { setCurrentView(AUTH_VIEWS.SIGNUP_FORM); setPhoneOtpValue(''); setError(''); }} className="text-sm text-slate-500 hover:text-[#082c59] flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> {t('auth.phone_otp_back_signup')}
            </button>
            <button onClick={() => sendPhoneOTP(pendingRegistration?.phone)} disabled={phoneOtpSending || phoneOtpCountdown > 240} className="text-sm text-[#082c59] hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5" /> {phoneOtpSending ? t('auth.phone_otp_sending') : t('auth.phone_otp_resend_code')}
            </button>
          </div>
        </>
      )}
    </FormModal>
  );
}

export function TwoFactorView({ error, isLoading, otpValue, setOtpValue, handle2FAVerify, goBack }) {
  const { t } = useTranslation();
  return (
    <FormModal>
      <div className="text-center mb-5">
        <img src="/images/logo.png" alt="Logo" className="h-12 w-auto mx-auto mb-3 object-contain" />
        <h2 className="text-xl font-bold text-slate-900">{t('auth.twofa_title')}</h2>
        <p className="text-slate-600 text-sm mt-1">{t('auth.twofa_desc')}</p>
      </div>
      {error && <Alert variant="destructive" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="flex justify-center mb-5">
        <InputOTP value={otpValue} onChange={setOtpValue} maxLength={6}>
          <InputOTPGroup>
            {[0, 1, 2, 3, 4, 5].map((index) => <InputOTPSlot key={index} index={index} className="w-10 h-12 text-lg bg-slate-50" />)}
          </InputOTPGroup>
        </InputOTP>
      </div>
      <Button onClick={handle2FAVerify} disabled={isLoading || otpValue.length !== 6} className="w-full h-11 bg-[#082c59] hover:bg-[#0a3a75] text-white font-medium rounded-xl">
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : t('auth.twofa_verify')}
      </Button>
      <button onClick={goBack} className="w-full text-center text-[#082c59] hover:underline mt-3 text-sm">
        {t('auth.twofa_back_login')}
      </button>
    </FormModal>
  );
}
