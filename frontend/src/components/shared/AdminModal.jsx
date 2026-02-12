import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * Shared modern modal wrapper with consistent styling across the admin dashboard.
 * Usage:
 *   <AdminModal open={...} onOpenChange={...} title="..." icon={<Icon/>} accentColor="blue" size="lg" footer={...}>
 *     <AdminModal.Section title="..." icon={<Icon/>}> ... </AdminModal.Section>
 *   </AdminModal>
 */

const ACCENT = {
  blue:    { headerBg: 'bg-gradient-to-r from-blue-600 to-indigo-600', iconBg: 'bg-white/20', btnBg: 'bg-blue-600 hover:bg-blue-700', sectionBorder: 'border-blue-100', sectionBg: 'bg-blue-50/40' },
  emerald: { headerBg: 'bg-gradient-to-r from-emerald-600 to-teal-600', iconBg: 'bg-white/20', btnBg: 'bg-emerald-600 hover:bg-emerald-700', sectionBorder: 'border-emerald-100', sectionBg: 'bg-emerald-50/40' },
  violet:  { headerBg: 'bg-gradient-to-r from-violet-600 to-purple-600', iconBg: 'bg-white/20', btnBg: 'bg-violet-600 hover:bg-violet-700', sectionBorder: 'border-violet-100', sectionBg: 'bg-violet-50/40' },
  amber:   { headerBg: 'bg-gradient-to-r from-amber-500 to-orange-500', iconBg: 'bg-white/20', btnBg: 'bg-amber-600 hover:bg-amber-700', sectionBorder: 'border-amber-100', sectionBg: 'bg-amber-50/40' },
  slate:   { headerBg: 'bg-gradient-to-r from-slate-700 to-slate-800', iconBg: 'bg-white/20', btnBg: 'bg-slate-700 hover:bg-slate-800', sectionBorder: 'border-slate-100', sectionBg: 'bg-slate-50/40' },
};

const SIZE_MAP = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-5xl',
};

export function AdminModal({ open, onOpenChange, title, subtitle, icon, accentColor = 'blue', size = 'lg', footer, children }) {
  const accent = ACCENT[accentColor] || ACCENT.blue;
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.lg;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`p-0 overflow-hidden ${sizeClass} max-h-[92vh] bg-white border-0 shadow-2xl`} data-testid="admin-modal">
        {/* Colored Header */}
        <div className={`${accent.headerBg} px-6 py-5 text-white`}>
          <div className="flex items-center gap-3">
            {icon && (
              <div className={`p-2.5 rounded-xl ${accent.iconBg} backdrop-blur-sm`}>
                {icon}
              </div>
            )}
            <div>
              <DialogTitle className="text-lg font-bold text-white">{title}</DialogTitle>
              {subtitle && <p className="text-sm text-white/70 mt-0.5">{subtitle}</p>}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto" style={{ maxHeight: 'calc(92vh - 140px)' }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t bg-slate-50/80 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Section divider inside a modal */
AdminModal.Section = function Section({ title, icon, children, className = '' }) {
  return (
    <div className={`mb-5 ${className}`}>
      {title && (
        <div className="flex items-center gap-2 mb-3">
          {icon && <span className="text-slate-500">{icon}</span>}
          <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{title}</h4>
        </div>
      )}
      {children}
    </div>
  );
};

/** Styled form field wrapper */
export function FormField({ label, required, children, hint }) {
  return (
    <div>
      <Label className="text-sm font-medium text-slate-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

/** Styled input that matches the modal theme */
export function StyledInput(props) {
  return (
    <Input
      {...props}
      className={`bg-slate-50/80 border-slate-200 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all ${props.className || ''}`}
    />
  );
}

/** Styled select trigger */
export function StyledSelect({ value, onValueChange, placeholder, children, ...props }) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="bg-slate-50/80 border-slate-200 focus:bg-white focus:border-blue-400" {...props}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="bg-white border shadow-lg">
        {children}
      </SelectContent>
    </Select>
  );
}
