import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';
import { AUTH_VIEWS, backgroundImages } from './auth/AuthConstants';
import { WelcomeView } from './auth/WelcomeView';
import { LoginView } from './auth/LoginView';
import { SignupRoleView } from './auth/SignupRoleView';
import { SignupFormView } from './auth/SignupFormView';
import { OperatorContactView, PhoneOtpView, TwoFactorView } from './auth/OtpViews';
import { ForgotPasswordView } from './auth/ForgotPasswordView';
import LanguageDropdown from '../components/shared/LanguageDropdown';

export default function AuthPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { login, register } = useAuth();
  
  const [currentView, setCurrentView] = useState(AUTH_VIEWS.WELCOME);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [bgIndex, setBgIndex] = useState(0);

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Rotate background images
  useEffect(() => {
    const interval = setInterval(() => setBgIndex(prev => (prev + 1) % backgroundImages.length), 6000);
    return () => clearInterval(interval);
  }, []);

  // Login state
  const [loginMethod, setLoginMethod] = useState('email');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register state
  const [selectedRole, setSelectedRole] = useState('customer');
  const [fullName, setFullName] = useState('');
  const [contactMethod, setContactMethod] = useState('email');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  
  // 2FA state
  const [otpValue, setOtpValue] = useState('');
  const [pending2FAData, setPending2FAData] = useState(null);
  
  // Phone OTP state
  const [phoneOtpValue, setPhoneOtpValue] = useState('');
  const [phoneOtpCountdown, setPhoneOtpCountdown] = useState(0);
  const [phoneOtpSending, setPhoneOtpSending] = useState(false);
  const [pendingRegistration, setPendingRegistration] = useState(null);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpVerifyMessage, setOtpVerifyMessage] = useState('');

  // Countdown timer for phone OTP
  useEffect(() => {
    if (phoneOtpCountdown > 0) {
      const timer = setInterval(() => setPhoneOtpCountdown(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [phoneOtpCountdown]);

  // Login handler
  const handleLogin = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const result = await login(loginIdentifier, loginPassword);
      if (result.access_token) {
        // Pick the best landing path per role / operator service type.
        const { resolveLandingPath } = await import('@/utils/operatorLandingPath');
        navigate(resolveLandingPath(result.user));
      } else if (result.requires_2fa) {
        setCurrentView(AUTH_VIEWS.TWO_FA);
      } else {
        setError(result.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'An error occurred during login.');
    } finally {
      setIsLoading(false);
    }
  }, [loginIdentifier, loginPassword, login, navigate]);

  // Send phone OTP
  const sendPhoneOTP = useCallback(async (phoneNumber) => {
    setPhoneOtpSending(true);
    setError('');
    try {
      const response = await api.post('/otp/send', { phone_number: phoneNumber });
      if (response.data.status === 'success') {
        setPhoneOtpCountdown(300);
        return true;
      } else {
        setError(response.data.message || 'Failed to send OTP');
        return false;
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send verification code.');
      return false;
    } finally {
      setPhoneOtpSending(false);
    }
  }, []);

  // Verify phone OTP
  const verifyPhoneOTP = useCallback(async () => {
    if (phoneOtpValue.length !== 6) { setError('Please enter the 6-digit code'); return; }
    setIsLoading(true);
    setError('');
    try {
      const response = await api.post('/otp/verify', { phone_number: pendingRegistration.phone, otp_code: phoneOtpValue });
      if (response.data.status === 'success') {
        setOtpVerified(true);
        setOtpVerifyMessage('Code accepted! Creating your account...');
        const result = await register(pendingRegistration);
        if (result.success || result.user_id) {
          setOtpVerifyMessage('Your account has been activated!');
          setTimeout(() => {
            setOtpVerified(false); setOtpVerifyMessage(''); setPhoneOtpValue(''); setPendingRegistration(null);
            setCurrentView(AUTH_VIEWS.LOGIN);
          }, 2500);
        } else {
          setOtpVerified(false); setOtpVerifyMessage('');
          setError(result.error || result.message || 'Registration failed.');
        }
      } else {
        setError(response.data.message || 'Invalid verification code');
      }
    } catch (err) {
      setOtpVerified(false); setOtpVerifyMessage('');
      setError(err.response?.data?.detail || 'Verification failed.');
    } finally {
      setIsLoading(false);
    }
  }, [phoneOtpValue, pendingRegistration, register]);

  // Register handler
  const handleRegister = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    if (registerPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    if (registerPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (!acceptTerms) { setError('Please accept the Terms and Privacy Policy'); return; }

    const regData = {
      full_name: fullName,
      email: contactMethod === 'email' ? registerEmail : undefined,
      phone: contactMethod === 'phone' ? registerPhone : undefined,
      password: registerPassword,
      role: selectedRole,
    };

    if (contactMethod === 'phone') {
      setIsLoading(true);
      const sent = await sendPhoneOTP(registerPhone);
      setIsLoading(false);
      if (sent) {
        setPendingRegistration(regData);
        setCurrentView(AUTH_VIEWS.PHONE_OTP_VERIFY);
      }
      return;
    }

    setIsLoading(true);
    try {
      const result = await register(regData);
      if (result.success || result.user_id) {
        setCurrentView(AUTH_VIEWS.LOGIN);
        setError('');
      } else {
        setError(result.error || result.message || 'Registration failed');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  }, [fullName, contactMethod, registerEmail, registerPhone, registerPassword, confirmPassword, acceptTerms, selectedRole, register, sendPhoneOTP]);

  // 2FA handler
  const handle2FAVerify = useCallback(async () => {
    if (otpValue.length !== 6) return;
    setIsLoading(true);
    setError('');
    try {
      const response = await api.post('/auth/verify-2fa', { user_id: pending2FAData?.user_id, code: otpValue });
      if (response.data.access_token) {
        navigate('/dashboard');
      } else {
        setError('Invalid code');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  }, [otpValue, pending2FAData, navigate]);

  const goBack = useCallback(() => {
    switch (currentView) {
      case AUTH_VIEWS.LOGIN:
      case AUTH_VIEWS.SIGNUP_ROLE: setCurrentView(AUTH_VIEWS.WELCOME); break;
      case AUTH_VIEWS.FORGOT_PASSWORD: setCurrentView(AUTH_VIEWS.LOGIN); break;
      case AUTH_VIEWS.SIGNUP_FORM:
      case AUTH_VIEWS.OPERATOR_CONTACT: setCurrentView(AUTH_VIEWS.SIGNUP_ROLE); break;
      case AUTH_VIEWS.TWO_FA: setCurrentView(AUTH_VIEWS.LOGIN); break;
      default: setCurrentView(AUTH_VIEWS.WELCOME);
    }
    setError('');
  }, [currentView]);

  const renderContent = () => {
    switch (currentView) {
      case AUTH_VIEWS.WELCOME:
        return <WelcomeView setCurrentView={setCurrentView} />;
      case AUTH_VIEWS.LOGIN:
        return <LoginView goBack={goBack} error={error} setError={setError} loginMethod={loginMethod} setLoginMethod={setLoginMethod} loginIdentifier={loginIdentifier} setLoginIdentifier={setLoginIdentifier} loginPassword={loginPassword} setLoginPassword={setLoginPassword} showPassword={showPassword} setShowPassword={setShowPassword} isLoading={isLoading} handleLogin={handleLogin} setCurrentView={setCurrentView} />;
      case AUTH_VIEWS.FORGOT_PASSWORD:
        return <ForgotPasswordView setCurrentView={setCurrentView} />;
      case AUTH_VIEWS.SIGNUP_ROLE:
        return <SignupRoleView goBack={goBack} selectedRole={selectedRole} setSelectedRole={setSelectedRole} setCurrentView={setCurrentView} />;
      case AUTH_VIEWS.SIGNUP_FORM:
        return <SignupFormView goBack={goBack} error={error} fullName={fullName} setFullName={setFullName} contactMethod={contactMethod} setContactMethod={setContactMethod} registerEmail={registerEmail} setRegisterEmail={setRegisterEmail} registerPhone={registerPhone} setRegisterPhone={setRegisterPhone} registerPassword={registerPassword} setRegisterPassword={setRegisterPassword} showPassword={showPassword} setShowPassword={setShowPassword} confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword} showConfirmPassword={showConfirmPassword} setShowConfirmPassword={setShowConfirmPassword} acceptTerms={acceptTerms} setAcceptTerms={setAcceptTerms} isLoading={isLoading} handleRegister={handleRegister} setCurrentView={setCurrentView} />;
      case AUTH_VIEWS.OPERATOR_CONTACT:
        return <OperatorContactView goBack={goBack} setSelectedRole={setSelectedRole} setCurrentView={setCurrentView} />;
      case AUTH_VIEWS.PHONE_OTP_VERIFY:
        return <PhoneOtpView error={error} isLoading={isLoading} otpVerified={otpVerified} otpVerifyMessage={otpVerifyMessage} phoneOtpValue={phoneOtpValue} setPhoneOtpValue={setPhoneOtpValue} phoneOtpCountdown={phoneOtpCountdown} phoneOtpSending={phoneOtpSending} pendingRegistration={pendingRegistration} verifyPhoneOTP={verifyPhoneOTP} sendPhoneOTP={sendPhoneOTP} setCurrentView={setCurrentView} setError={setError} />;
      case AUTH_VIEWS.TWO_FA:
        return <TwoFactorView error={error} isLoading={isLoading} otpValue={otpValue} setOtpValue={setOtpValue} handle2FAVerify={handle2FAVerify} goBack={goBack} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-[60%] relative overflow-hidden">
        {backgroundImages.map((img, index) => (
          <div key={index} className={`absolute inset-0 transition-opacity duration-1000 ${index === bgIndex ? 'opacity-100' : 'opacity-0'}`}>
            <img src={img} alt={`Background ${index + 1}`} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#082c59]/80 to-[#082c59]/40" />
          </div>
        ))}

        {/* Language switch — floats over the hero image so it's discoverable
            before the user has typed anything. Compact variant reads well
            against the dark navy overlay. */}
        <div className="absolute top-6 right-6 z-20">
          <LanguageDropdown variant="compact" align="end" />
        </div>

        <div className="relative z-10 flex flex-col justify-end p-12 text-white">
          <h2 className="text-4xl font-bold mb-4">{t('auth.hero_headline')}</h2>
          <p className="text-lg text-white/80">{t('auth.hero_subline')}</p>
          <div className="flex gap-2 mt-8">
            {backgroundImages.map((_, index) => (
              <button key={index} onClick={() => setBgIndex(index)} className={`w-2 h-2 rounded-full transition-all ${index === bgIndex ? 'bg-white w-8' : 'bg-white/50'}`} />
            ))}
          </div>
        </div>
      </div>
      <div className="w-full lg:w-[40%] bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col">
        <div className="lg:hidden p-4 border-b border-slate-200 bg-white flex items-center justify-between">
          <img src="/images/logo.png" alt="Logo" className="h-10 w-auto object-contain" />
          {/* Mobile: dropdown lives in the header since there's no hero panel. */}
          <LanguageDropdown variant="ghost" align="end" />
        </div>
        {/* Desktop: mirrored dropdown in the right panel so it's still
            reachable from the login form itself, not only the hero. */}
        <div className="hidden lg:flex justify-end px-6 pt-4">
          <LanguageDropdown variant="ghost" align="end" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
