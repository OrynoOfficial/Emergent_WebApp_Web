import { Card, CardContent } from '@/components/ui/card';

export const AUTH_VIEWS = {
  WELCOME: 'welcome',
  LOGIN: 'login',
  SIGNUP_ROLE: 'signup_role',
  SIGNUP_FORM: 'signup_form',
  OPERATOR_CONTACT: 'operator_contact',
  TWO_FA: '2fa',
  PHONE_OTP_VERIFY: 'phone_otp_verify'
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
