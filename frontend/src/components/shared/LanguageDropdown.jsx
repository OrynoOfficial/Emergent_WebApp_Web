// Compact language switcher used both on the login page (unauthenticated)
// and inside the top-nav / Settings (authenticated). Persists via
// localStorage AND syncs with the user's saved `preferences.language`
// when the user is signed in.
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { setAppLanguage, getAppLanguage, SUPPORTED_LANGUAGES } from '@/i18n';
import api from '@/api/client';

export default function LanguageDropdown({
  variant = 'default', // 'default' | 'compact' | 'ghost'
  showLabel = true,
  persistToServer = false, // set true inside authenticated shells
  className = '',
  align = 'end',
}) {
  const { t } = useTranslation();
  const current = getAppLanguage();
  const active = SUPPORTED_LANGUAGES.find((l) => l.code === current) || SUPPORTED_LANGUAGES[0];

  const handleChange = async (code) => {
    if (code === current) return;
    await setAppLanguage(code);
    if (persistToServer) {
      try {
        await api.put('/users/me/preferences', { language: code });
      } catch {
        // Best-effort — the local change already happened; a later sync will retry.
      }
    }
  };

  const triggerClasses = {
    default: 'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-full hover:border-slate-300 hover:bg-slate-50 transition',
    compact: 'flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-white/10 hover:bg-white/20 text-white rounded-full transition backdrop-blur-sm',
    ghost:   'flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition',
  }[variant];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`${triggerClasses} ${className}`}
        data-testid="language-dropdown-trigger"
        aria-label={t('common.language')}
      >
        <span className="text-sm leading-none">{active.flag}</span>
        {showLabel && <span className="uppercase tracking-wide">{active.code}</span>}
        <ChevronDown className="h-3 w-3 opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-44">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold flex items-center gap-1.5">
          <Globe className="h-3 w-3" />
          {t('common.language')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onSelect={() => handleChange(lang.code)}
            className="cursor-pointer flex items-center gap-2 text-sm"
            data-testid={`language-option-${lang.code}`}
          >
            <span className="text-base leading-none">{lang.flag}</span>
            <span className="flex-1">{lang.label}</span>
            {lang.code === current && <Check className="h-4 w-4 text-[#082c59]" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
