import React, { useState, useCallback } from 'react';
import { User, Mail, Phone, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import api from '@/api/client';

/**
 * Shared "Guest/Booker Information" section used across all booking pages.
 * Matches the Hotel Booking page template (gradient header, toggle, 4 fields).
 *
 * Props:
 *  - title: Header title (e.g. "Guest Information", "Traveler Details")
 *  - subtitle: Header subtitle (e.g. "Who will be staying?")
 *  - toggleLabel: Label for the self-fill toggle (e.g. "I'm the Guest")
 *  - firstName, lastName, email, phone: current values
 *  - onChange(field, value): callback to update parent form state
 *  - user: current auth user object (for fallback)
 *  - isSelf: controlled toggle state
 *  - onSelfChange(checked): callback for toggle
 */
export function BookerInfoSection({
  title = 'Guest Information',
  subtitle = 'Who will be checking in?',
  toggleLabel = "I'm the Guest",
  firstName = '',
  lastName = '',
  email = '',
  phone = '',
  onChange,
  user,
  isSelf = false,
  onSelfChange,
}) {
  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-[#082c59] to-[#0a4a8f] p-5">
        <div className="flex items-center gap-3 text-white">
          <div className="p-2 bg-white/20 rounded-xl">
            <User className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg">{title}</h3>
            <p className="text-sm text-white/70">{subtitle}</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Self-fill toggle */}
        <div className={`mb-6 p-4 rounded-xl border-2 transition-all ${
          isSelf ? 'bg-[#082c59]/10 border-[#082c59]/30' : 'bg-slate-100 border-slate-300'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className={`h-5 w-5 ${isSelf ? 'text-[#082c59]' : 'text-slate-500'}`} />
              <span className="font-semibold text-slate-800">{toggleLabel}</span>
            </div>
            <Switch
              checked={isSelf}
              onCheckedChange={onSelfChange}
              className="data-[state=checked]:bg-[#082c59] data-[state=unchecked]:bg-slate-400"
            />
          </div>
          <p className="text-sm text-slate-500 mt-2 ml-8">Auto-fill with your profile information</p>
        </div>

        {/* Form fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label htmlFor="booker-firstName" className="text-sm font-medium text-slate-700">
              First Name <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="booker-firstName"
                value={firstName}
                onChange={(e) => onChange('firstName', e.target.value)}
                disabled={isSelf}
                className="pl-10 h-12 rounded-xl border-slate-200 focus:ring-2 focus:ring-[#082c59]/20"
                placeholder="Enter first name"
                data-testid="booker-first-name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="booker-lastName" className="text-sm font-medium text-slate-700">
              Last Name <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="booker-lastName"
                value={lastName}
                onChange={(e) => onChange('lastName', e.target.value)}
                disabled={isSelf}
                className="pl-10 h-12 rounded-xl border-slate-200 focus:ring-2 focus:ring-[#082c59]/20"
                placeholder="Enter last name"
                data-testid="booker-last-name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="booker-email" className="text-sm font-medium text-slate-700">
              Email <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="booker-email"
                type="email"
                value={email}
                onChange={(e) => onChange('email', e.target.value)}
                className="pl-10 h-12 rounded-xl border-slate-200 focus:ring-2 focus:ring-[#082c59]/20"
                placeholder="Enter email address"
                data-testid="booker-email"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="booker-phone" className="text-sm font-medium text-slate-700">
              Phone <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="booker-phone"
                value={phone}
                onChange={(e) => onChange('phone', e.target.value)}
                disabled={isSelf}
                className="pl-10 h-12 rounded-xl border-slate-200 focus:ring-2 focus:ring-[#082c59]/20"
                placeholder="+237 xxx xxx xxx"
                data-testid="booker-phone"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage the "I am the booker" toggle logic.
 * Fetches latest profile from /api/auth/me and fills first/last name, email, phone.
 */
export function useBookerSelfFill(user, setFormFields) {
  const [isSelf, setIsSelf] = useState(false);

  const handleSelfChange = useCallback(async (checked) => {
    setIsSelf(checked);
    if (checked) {
      try {
        const res = await api.get('/auth/me');
        const profile = res.data;
        const fullName = profile.full_name || '';
        const nameParts = fullName.trim().split(/\s+/);
        setFormFields({
          firstName: profile.first_name || nameParts[0] || '',
          lastName: profile.last_name || nameParts.slice(1).join(' ') || '',
          email: profile.email || '',
          phone: profile.phone || '',
        });
      } catch {
        // Fallback to cached user object
        if (user) {
          const fullName = user.full_name || '';
          const nameParts = fullName.trim().split(/\s+/);
          setFormFields({
            firstName: user.first_name || nameParts[0] || '',
            lastName: user.last_name || nameParts.slice(1).join(' ') || '',
            email: user.email || '',
            phone: user.phone || '',
          });
        }
      }
    } else {
      setFormFields({ firstName: '', lastName: '', phone: '' });
    }
  }, [user, setFormFields]);

  return { isSelf, handleSelfChange };
}
