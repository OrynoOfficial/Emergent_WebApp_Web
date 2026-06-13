import { Card, CardContent } from '@/components/ui/card';

export const AUTH_VIEWS = {
  WELCOME: 'welcome',
  LOGIN: 'login',
  FORGOT_PASSWORD: 'forgot_password',
  SIGNUP_ROLE: 'signup_role',
  SIGNUP_FORM: 'signup_form',
  OPERATOR_CONTACT: 'operator_contact',
  TWO_FA: '2fa',
  PHONE_OTP_VERIFY: 'phone_otp_verify'
};

// Marketing website (apex domain) — used everywhere the auth flow links
// "off-platform" (Return to homepage, Terms of Service, Privacy Policy,
// Contact form, etc.). Centralised here so a future rebrand only touches
// one constant.
export const MARKETING_SITE = 'https://oryno.tech';
export const MARKETING_LINKS = {
  HOME:     `${MARKETING_SITE}/hero`,
  TERMS:    `${MARKETING_SITE}/terms`,
  PRIVACY:  `${MARKETING_SITE}/privacy`,
  CONTACT:  `${MARKETING_SITE}/contact`,
};

export const backgroundImages = [
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2070',
  'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?q=80&w=2070',
  'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?q=80&w=2070',
  'https://images.unsplash.com/photo-1540541338287-41700207dee6?q=80&w=2070'
];

export const FormModal = ({ children }) => (
  <div className="flex items-center justify-center min-h-full p-4 sm:p-8">
    <Card className="w-full max-w-md bg-white/95 backdrop-blur-md shadow-2xl border-0 rounded-2xl overflow-hidden">
      <CardContent className="p-6 sm:p-8">
        {children}
      </CardContent>
    </Card>
  </div>
);
