// Oryno i18n bootstrap — mirrors the mobile app's translation setup.
// English + French, persisted to localStorage, synchronised with the
// user's saved `preferences.language` on login.
//
// Consumers use the standard react-i18next hook:
//   const { t } = useTranslation();
//   <p>{t('common.book_now')}</p>
//
// To change language at runtime, use setAppLanguage() below (handles both
// i18n + localStorage + the <html lang> attribute in one call).
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import fr from './locales/fr.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
];

export const DEFAULT_LANGUAGE = 'en';
const STORAGE_KEY = 'oryno_language';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
    },
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    // Only take the language tag, ignore the region (fr-CA → fr).
    load: 'languageOnly',
    interpolation: { escapeValue: false }, // React handles XSS
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: STORAGE_KEY,
      caches: ['localStorage'],
    },
    react: { useSuspense: false },
  });

// Keep <html lang> in sync on every change (helps screen readers + SEO).
i18n.on('languageChanged', (lng) => {
  try {
    document.documentElement.setAttribute('lang', lng);
  } catch { /* SSR safety */ }
});

/**
 * Change the app language everywhere at once.
 * - Updates i18n runtime
 * - Persists to localStorage
 * - Fires an event so components that read `getAppLanguage()` synchronously
 *   (e.g. date formatters) can re-render.
 */
export function setAppLanguage(code) {
  const normalised = SUPPORTED_LANGUAGES.some((l) => l.code === code) ? code : DEFAULT_LANGUAGE;
  try { localStorage.setItem(STORAGE_KEY, normalised); } catch { /* ignore */ }
  return i18n.changeLanguage(normalised);
}

/** Get the currently active language (short code: 'en' | 'fr'). */
export function getAppLanguage() {
  return (i18n.resolvedLanguage || i18n.language || DEFAULT_LANGUAGE).split('-')[0];
}

export default i18n;
