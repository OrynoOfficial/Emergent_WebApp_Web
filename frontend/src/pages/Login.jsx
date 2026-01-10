import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Checkbox } from '../components/ui/checkbox';
import { Card, CardContent } from '../components/ui/card';
import { 
  Eye, EyeOff, Mail, Lock, User, Phone, Loader2, 
  ArrowLeft, Home, Building2, Globe, ChevronDown, FileText
} from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../components/ui/input-otp';

const backgroundImages = [
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2070',
  'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?q=80&w=2070',
  'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?q=80&w=2070',
  'https://images.unsplash.com/photo-1540541338287-41700207dee6?q=80&w=2070'
];

// Auth flow states
const AUTH_VIEWS = {
  WELCOME: 'welcome',
  LOGIN: 'login',
  SIGNUP_ROLE: 'signup_role',
  SIGNUP_FORM: 'signup_form',
  OPERATOR_CONTACT: 'operator_contact',
  TWO_FA: '2fa',
  PHONE_OTP_VERIFY: 'phone_otp_verify'
};

// FormModal component extracted outside to prevent re-creation on every render
const FormModal = ({ children }) => (
  <div className="flex items-center justify-center min-h-full p-4 sm:p-8">
    <Card className="w-full max-w-md bg-white/95 backdrop-blur-md shadow-2xl border-0 rounded-2xl overflow-hidden">
      <CardContent className="p-6 sm:p-8">
        {children}
      </CardContent>
    </Card>
  </div>
);

export default function AuthPage() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  
  const [currentView, setCurrentView] = useState(AUTH_VIEWS.WELCOME);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [bgIndex, setBgIndex] = useState(0);
  
  // Signup flow state
  const [selectedRole, setSelectedRole] = useState('customer');
  const [contactMethod, setContactMethod] = useState('email');
  
  // Login form
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginMethod, setLoginMethod] = useState('email'); // 'email' or 'phone'
  const [loginPassword, setLoginPassword] = useState('');
  const [isOperator, setIsOperator] = useState(false);
  
  // Register form
  const [fullName, setFullName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  
  // 2FA state
  const [otpValue, setOtpValue] = useState('');
  
  // Phone OTP verification state
  const [phoneOtpValue, setPhoneOtpValue] = useState('');
  const [phoneOtpSending, setPhoneOtpSending] = useState(false);
  const [phoneOtpCountdown, setPhoneOtpCountdown] = useState(0);
  const [pendingRegistration, setPendingRegistration] = useState(null);

  // Background slideshow
  useEffect(() => {
    const interval = setInterval(() => {
      setBgIndex((prev) => (prev + 1) % backgroundImages.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const result = await login(loginIdentifier, loginPassword);
      
      if (result.access_token) {
        // Redirect based on user role
        const userRole = result.user?.role;
        const isOperator = userRole === 'operator' || result.user?.operator_context;
        
        if (userRole === 'super_admin') {
          // Super Admin landing: Analytics Dashboard
          navigate('/admin/analytics');
        } else if (userRole === 'admin') {
          // Admin landing: Admin Dashboard
          navigate('/admin/admin-dashboard');
        } else if (isOperator) {
          // Operator landing: Analytics Dashboard (their personalized view)
          navigate('/admin/analytics');
        } else {
          // Customer landing: Dashboard
          navigate('/dashboard');
        }
      } else if (result.requires_2fa) {
        setCurrentView(AUTH_VIEWS.TWO_FA);
      } else {
        setError(result.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.detail || err.message || 'An error occurred during login.');
    } finally {
      setIsLoading(false);
    }
  }, [loginIdentifier, loginPassword, login, navigate]);

  // Send phone OTP for verification
  const sendPhoneOTP = useCallback(async (phoneNumber) => {
    setPhoneOtpSending(true);
    setError('');
    
    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL || '';
      const response = await fetch(`${API_URL}/api/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phoneNumber })
      });
      
      const data = await response.json();
      
      if (response.ok && data.status === 'success') {
        setPhoneOtpCountdown(300); // 5 minutes countdown
        return true;
      } else {
        setError(data.detail || data.message || 'Failed to send OTP');
        return false;
      }
    } catch (err) {
      console.error('OTP send error:', err);
      setError('Failed to send verification code. Please try again.');
      return false;
    } finally {
      setPhoneOtpSending(false);
    }
  }, []);

  // Verify phone OTP
  const verifyPhoneOTP = useCallback(async () => {
    if (phoneOtpValue.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL || '';
      const response = await fetch(`${API_URL}/api/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone_number: pendingRegistration.phone,
          otp_code: phoneOtpValue 
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.status === 'success') {
        // OTP verified, now complete registration
        const result = await register(pendingRegistration);
        
        if (result.success || result.user_id) {
          // Auto-login after successful registration
          try {
            const loginResult = await login(pendingRegistration.phone, pendingRegistration.password);
            if (loginResult.access_token) {
              navigate('/dashboard');
            } else {
              setError('Registration successful! Please login with your credentials.');
              setCurrentView(AUTH_VIEWS.LOGIN);
            }
          } catch {
            setError('Registration successful! Please login with your phone number.');
            setCurrentView(AUTH_VIEWS.LOGIN);
          }
        } else {
          setError(result.message || 'Registration failed. Please try again.');
        }
      } else {
        setError(data.detail || data.message || 'Invalid verification code');
      }
    } catch (err) {
      console.error('OTP verify error:', err);
      setError('Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [phoneOtpValue, pendingRegistration, register, login, navigate]);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (phoneOtpCountdown > 0) {
      const timer = setTimeout(() => setPhoneOtpCountdown(phoneOtpCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [phoneOtpCountdown]);

  const handleRegister = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    
    if (registerPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (!acceptTerms) {
      setError('Please accept the terms and conditions');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const normalizedPhone = registerPhone ? registerPhone.replace(/[\s\-\(\)]/g, '') : null;
      
      const userData = {
        email: contactMethod === 'email' ? registerEmail : `${normalizedPhone}@phone.local`,
        username: contactMethod === 'email' ? registerEmail : normalizedPhone,
        password: registerPassword,
        full_name: fullName,
        phone: normalizedPhone,
        role: selectedRole
      };
      
      // If phone registration, verify with OTP first
      if (contactMethod === 'phone' && normalizedPhone) {
        setPendingRegistration(userData);
        const otpSent = await sendPhoneOTP(normalizedPhone);
        if (otpSent) {
          setCurrentView(AUTH_VIEWS.PHONE_OTP_VERIFY);
        }
        setIsLoading(false);
        return;
      }
      
      // Email registration - proceed directly
      const result = await register(userData);
      
      if (result.success || result.user_id) {
        if (!result.requires_verification) {
          try {
            const loginResult = await login(registerEmail, registerPassword);
            if (loginResult.access_token) {
              navigate('/dashboard');
            } else {
              setError('Registration successful! Please login with your credentials.');
              setCurrentView(AUTH_VIEWS.LOGIN);
            }
          } catch {
            setError('Registration successful! Please login with your credentials.');
            setCurrentView(AUTH_VIEWS.LOGIN);
          }
        } else {
          setError('Registration successful! Please check your email to verify your account, then login.');
          setCurrentView(AUTH_VIEWS.LOGIN);
        }
      } else {
        setError(result.message || 'Registration failed. Please try again.');
      }
    } catch (err) {
      console.error('Register error:', err);
      setError(err.response?.data?.detail || err.message || 'An error occurred during registration.');
    } finally {
      setIsLoading(false);
    }
  }, [fullName, registerEmail, registerPhone, registerPassword, confirmPassword, acceptTerms, contactMethod, selectedRole, login, register, navigate, sendPhoneOTP]);

  const handle2FAVerify = useCallback(async () => {
    if (otpValue.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      navigate('/dashboard');
    } catch {
      setError('Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  }, [otpValue, navigate]);

  const goBack = useCallback(() => {
    switch (currentView) {
      case AUTH_VIEWS.LOGIN:
      case AUTH_VIEWS.SIGNUP_ROLE:
        setCurrentView(AUTH_VIEWS.WELCOME);
        break;
      case AUTH_VIEWS.SIGNUP_FORM:
      case AUTH_VIEWS.OPERATOR_CONTACT:
        setCurrentView(AUTH_VIEWS.SIGNUP_ROLE);
        break;
      case AUTH_VIEWS.TWO_FA:
        setCurrentView(AUTH_VIEWS.LOGIN);
        break;
      default:
        setCurrentView(AUTH_VIEWS.WELCOME);
    }
    setError('');
  }, [currentView]);

  // Render content based on view
  const renderContent = () => {
    switch (currentView) {
      case AUTH_VIEWS.WELCOME:
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
              <Button
                onClick={() => setCurrentView(AUTH_VIEWS.LOGIN)}
                className="w-full h-12 bg-[#082c59] hover:bg-[#0a3a75] text-white font-medium rounded-xl"
              >
                <Lock className="mr-2 h-5 w-5" />
                Login to Your Account
              </Button>
              
              <Button
                onClick={() => setCurrentView(AUTH_VIEWS.SIGNUP_ROLE)}
                variant="outline"
                className="w-full h-12 border-2 border-[#082c59] text-[#082c59] hover:bg-[#082c59]/5 font-medium rounded-xl"
              >
                <User className="mr-2 h-5 w-5" />
                Create New Account
              </Button>
            </div>
            
            <p className="text-xs text-slate-500 mt-6 text-center">
              By continuing, you agree to our{' '}
              <Link to="/terms" className="text-[#082c59] hover:underline">Terms of Service</Link>
              {' '}and{' '}
              <Link to="/privacy" className="text-[#082c59] hover:underline">Privacy Policy</Link>
            </p>
            
            <Link to="/" className="flex items-center justify-center gap-2 text-slate-500 hover:text-[#082c59] mt-4 text-sm">
              <Home className="h-4 w-4" />
              Return to Homepage
            </Link>
          </FormModal>
        );
        
      case AUTH_VIEWS.LOGIN:
        return (
          <FormModal>
            <div className="flex items-center justify-between mb-4">
              <button onClick={goBack} className="flex items-center text-slate-600 hover:text-[#082c59] text-sm">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </button>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Globe className="h-3 w-3" />
                <span>EN</span>
              </div>
            </div>
            
            <div className="text-center mb-5">
              <img src="/images/logo.png" alt="Logo" className="h-12 w-auto mx-auto mb-2 object-contain" />
              <h1 className="text-xl font-bold text-slate-900">Welcome Back</h1>
              <p className="text-slate-500 text-sm">Login to your account</p>
            </div>
            
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Login Method Toggle */}
              <div className="flex rounded-lg overflow-hidden border border-slate-200">
                <button
                  type="button"
                  onClick={() => { setLoginMethod('email'); setLoginIdentifier(''); }}
                  className={`flex-1 py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                    loginMethod === 'email' 
                      ? 'bg-[#082c59] text-white' 
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Mail className="h-4 w-4" />
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => { setLoginMethod('phone'); setLoginIdentifier(''); }}
                  className={`flex-1 py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                    loginMethod === 'phone' 
                      ? 'bg-[#082c59] text-white' 
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Phone className="h-4 w-4" />
                  Phone
                </button>
              </div>
              
              <div>
                <Label htmlFor="login-identifier" className="text-slate-700 text-sm">
                  {loginMethod === 'email' ? 'Email Address' : 'Phone Number'}
                </Label>
                <div className="relative mt-1">
                  {loginMethod === 'email' ? (
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none z-10" />
                  ) : (
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none z-10" />
                  )}
                  <Input
                    id="login-identifier"
                    type={loginMethod === 'email' ? 'email' : 'tel'}
                    placeholder={loginMethod === 'email' ? 'your@email.com' : '+237 6XX XXX XXX'}
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    className="pl-10 h-11 bg-white border-slate-200 focus:bg-white focus:border-[#082c59] focus:ring-2 focus:ring-[#082c59]/20 transition-all caret-[#082c59]"
                    autoComplete={loginMethod === 'email' ? 'email' : 'tel'}
                    required
                  />
                </div>
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
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                <Checkbox
                  id="isOperator"
                  checked={isOperator}
                  onCheckedChange={(checked) => setIsOperator(checked)}
                />
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-500" />
                  <Label htmlFor="isOperator" className="text-sm text-slate-700 cursor-pointer">
                    I&apos;m logging in as a service operator
                  </Label>
                </div>
              </div>
              
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-[#082c59] hover:bg-[#0a3a75] text-white font-medium rounded-xl"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Login'}
              </Button>
            </form>
            
            <p className="text-center text-slate-600 mt-4 text-sm">
              Don&apos;t have an account?{' '}
              <button
                onClick={() => setCurrentView(AUTH_VIEWS.SIGNUP_ROLE)}
                className="text-[#082c59] font-medium hover:underline"
              >
                Sign up
              </button>
            </p>
          </FormModal>
        );
        
      case AUTH_VIEWS.SIGNUP_ROLE:
        return (
          <FormModal>
            <div className="flex items-center justify-between mb-4">
              <button onClick={goBack} className="flex items-center text-slate-600 hover:text-[#082c59] text-sm">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </button>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Globe className="h-3 w-3" />
                <span>EN</span>
              </div>
            </div>
            
            <div className="text-center mb-5">
              <img src="/images/logo.png" alt="Logo" className="h-12 w-auto mx-auto mb-2 object-contain" />
              <h1 className="text-xl font-bold text-slate-900">Create Account</h1>
              <p className="text-slate-500 text-sm">I want to sign up as a</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => setSelectedRole('customer')}
                className={`p-4 rounded-xl border-2 text-center transition-all hover:scale-[1.02] ${
                  selectedRole === 'customer'
                    ? 'border-[#082c59] bg-blue-50 shadow-md'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className={`w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center ${
                  selectedRole === 'customer' ? 'bg-[#082c59]' : 'bg-slate-100'
                }`}>
                  <User className={`h-6 w-6 ${selectedRole === 'customer' ? 'text-white' : 'text-slate-500'}`} />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Customer</h3>
                <p className="text-xs text-slate-500 mt-1">Book services</p>
              </button>
              
              <button
                onClick={() => setSelectedRole('operator')}
                className={`p-4 rounded-xl border-2 text-center transition-all hover:scale-[1.02] ${
                  selectedRole === 'operator'
                    ? 'border-[#082c59] bg-blue-50 shadow-md'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className={`w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center ${
                  selectedRole === 'operator' ? 'bg-[#082c59]' : 'bg-slate-100'
                }`}>
                  <Building2 className={`h-6 w-6 ${selectedRole === 'operator' ? 'text-white' : 'text-slate-500'}`} />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Operator</h3>
                <p className="text-xs text-slate-500 mt-1">Provide services</p>
              </button>
            </div>
            
            <Button
              onClick={() => {
                if (selectedRole === 'operator') {
                  setCurrentView(AUTH_VIEWS.OPERATOR_CONTACT);
                } else {
                  setCurrentView(AUTH_VIEWS.SIGNUP_FORM);
                }
              }}
              className="w-full h-11 bg-[#082c59] hover:bg-[#0a3a75] text-white font-medium rounded-xl"
            >
              Continue
            </Button>
            
            <p className="text-center text-slate-600 mt-4 text-sm">
              Already have an account?{' '}
              <button
                onClick={() => setCurrentView(AUTH_VIEWS.LOGIN)}
                className="text-[#082c59] font-medium hover:underline"
              >
                Login
              </button>
            </p>
          </FormModal>
        );
        
      case AUTH_VIEWS.SIGNUP_FORM:
        return (
          <FormModal>
            <div className="flex items-center justify-between mb-4">
              <button onClick={goBack} className="flex items-center text-slate-600 hover:text-[#082c59] text-sm">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </button>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Globe className="h-3 w-3" />
                <span>EN</span>
              </div>
            </div>
            
            <div className="text-center mb-4">
              <h1 className="text-xl font-bold text-slate-900">Create Account</h1>
              <p className="text-slate-500 text-sm">Fill in your details</p>
            </div>
            
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <Label htmlFor="fullName" className="text-slate-700 text-sm">Full Name</Label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10 h-10 bg-slate-50 border-slate-200"
                    required
                  />
                </div>
              </div>
              
              <div>
                <Label className="text-slate-700 text-sm">Contact Method</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setContactMethod('email')}
                    className={`flex items-center justify-center gap-2 p-2 rounded-lg border-2 transition-all text-sm ${
                      contactMethod === 'email'
                        ? 'bg-[#082c59] text-white border-[#082c59]'
                        : 'border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <Mail className="h-4 w-4" />
                    <span className="font-medium">Email</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setContactMethod('phone')}
                    className={`flex items-center justify-center gap-2 p-2 rounded-lg border-2 transition-all text-sm ${
                      contactMethod === 'phone'
                        ? 'bg-[#082c59] text-white border-[#082c59]'
                        : 'border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <Phone className="h-4 w-4" />
                    <span className="font-medium">Phone</span>
                  </button>
                </div>
              </div>
              
              {contactMethod === 'email' ? (
                <div>
                  <Label htmlFor="register-email" className="text-slate-700 text-sm">Email Address</Label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="your@email.com"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      className="pl-10 h-10 bg-slate-50 border-slate-200"
                      required
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <Label htmlFor="register-phone" className="text-slate-700 text-sm">Phone Number</Label>
                  <div className="relative mt-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <Input
                      id="register-phone"
                      type="tel"
                      placeholder="+237 6XX XXX XXX"
                      value={registerPhone}
                      onChange={(e) => setRegisterPhone(e.target.value)}
                      className="pl-10 h-10 bg-slate-50 border-slate-200"
                      required
                    />
                  </div>
                </div>
              )}
              
              <div>
                <Label htmlFor="register-password" className="text-slate-700 text-sm">Password</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <Input
                    id="register-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a password"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    className="pl-10 pr-10 h-10 bg-slate-50 border-slate-200"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              <div>
                <Label htmlFor="confirmPassword" className="text-slate-700 text-sm">Confirm Password</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 pr-10 h-10 bg-slate-50 border-slate-200"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <Checkbox
                  id="acceptTerms"
                  checked={acceptTerms}
                  onCheckedChange={(checked) => setAcceptTerms(checked)}
                  className="mt-0.5"
                />
                <Label htmlFor="acceptTerms" className="text-xs text-slate-600 cursor-pointer">
                  I agree to the{' '}
                  <Link to="/terms" className="text-[#082c59] hover:underline">Terms</Link>
                  {' '}and{' '}
                  <Link to="/privacy" className="text-[#082c59] hover:underline">Privacy Policy</Link>
                </Label>
              </div>
              
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-[#082c59] hover:bg-[#0a3a75] text-white font-medium rounded-xl"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Create Account'}
              </Button>
            </form>
            
            <p className="text-center text-slate-600 mt-3 text-sm">
              Already have an account?{' '}
              <button
                onClick={() => setCurrentView(AUTH_VIEWS.LOGIN)}
                className="text-[#082c59] font-medium hover:underline"
              >
                Login
              </button>
            </p>
          </FormModal>
        );
        
      case AUTH_VIEWS.OPERATOR_CONTACT:
        return (
          <FormModal>
            <div className="flex items-center justify-between mb-4">
              <button onClick={goBack} className="flex items-center text-slate-600 hover:text-[#082c59] text-sm">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </button>
            </div>
            
            <div className="text-center mb-4">
              <img src="/images/logo.png" alt="Logo" className="h-12 w-auto mx-auto mb-2 object-contain" />
              <h1 className="text-xl font-bold text-slate-900">Become an Operator</h1>
            </div>
            
            <div className="bg-slate-50 rounded-xl p-5 mb-4">
              <p className="text-slate-600 text-sm mb-4">
                We&apos;re excited to partner with you. Fill out our contact form to get started with personalized onboarding.
              </p>
              
              <Button
                onClick={() => window.open('/contact?type=operator', '_blank')}
                className="w-full h-11 bg-[#082c59] hover:bg-[#0a3a75] text-white font-medium rounded-xl"
              >
                <Mail className="mr-2 h-4 w-4" />
                Contact Us via Form
              </Button>
              
              <button
                onClick={() => {
                  setSelectedRole('customer');
                  setCurrentView(AUTH_VIEWS.SIGNUP_FORM);
                }}
                className="w-full text-center text-[#082c59] hover:underline mt-3 text-sm"
              >
                ← Back to Customer Signup
              </button>
            </div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <h3 className="font-semibold text-amber-800 text-sm mb-1">What to expect</h3>
              <p className="text-xs text-amber-700">
                Our partnerships team will reach out within 24-48 hours to discuss your business and services.
              </p>
            </div>
          </FormModal>
        );
        
      case AUTH_VIEWS.TWO_FA:
        return (
          <FormModal>
            <div className="text-center mb-5">
              <img src="/images/logo.png" alt="Logo" className="h-12 w-auto mx-auto mb-3 object-contain" />
              <h2 className="text-xl font-bold text-slate-900">Two-Factor Authentication</h2>
              <p className="text-slate-600 text-sm mt-1">Enter the 6-digit code from your authenticator app</p>
            </div>
            
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="flex justify-center mb-5">
              <InputOTP value={otpValue} onChange={setOtpValue} maxLength={6}>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <InputOTPSlot key={index} index={index} className="w-10 h-12 text-lg bg-slate-50" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            
            <Button
              onClick={handle2FAVerify}
              disabled={isLoading || otpValue.length !== 6}
              className="w-full h-11 bg-[#082c59] hover:bg-[#0a3a75] text-white font-medium rounded-xl"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Verify'}
            </Button>
            
            <button
              onClick={goBack}
              className="w-full text-center text-[#082c59] hover:underline mt-3 text-sm"
            >
              ← Back to Login
            </button>
          </FormModal>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Background Images (60%) */}
      <div className="hidden lg:flex lg:w-[60%] relative overflow-hidden">
        {backgroundImages.map((img, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              index === bgIndex ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <img
              src={img}
              alt={`Background ${index + 1}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#082c59]/80 to-[#082c59]/40" />
          </div>
        ))}
        
        <div className="relative z-10 flex flex-col justify-end p-12 text-white">
          <h2 className="text-4xl font-bold mb-4">Your Gateway to Amazing Services</h2>
          <p className="text-lg text-white/80">
            Book hotels, travel tickets, restaurants, and more — all in one place.
          </p>
          
          <div className="flex gap-2 mt-8">
            {backgroundImages.map((_, index) => (
              <button
                key={index}
                onClick={() => setBgIndex(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === bgIndex ? 'bg-white w-8' : 'bg-white/50'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
      
      {/* Right Side - Auth Forms (40%) */}
      <div className="w-full lg:w-[40%] bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col">
        <div className="lg:hidden p-4 border-b border-slate-200 bg-white">
          <img src="/images/logo.png" alt="Logo" className="h-10 w-auto object-contain" />
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
