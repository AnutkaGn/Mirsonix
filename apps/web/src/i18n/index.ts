import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@mirsonix/shared';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enCommon from './locales/en/common.json';

// To add a language: drop a locales/<code>/ folder, register it here and add the code to SUPPORTED_LOCALES.
void i18n.use(initReactI18next).init({
  resources: { en: { common: enCommon } },
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: [...SUPPORTED_LOCALES],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

export default i18n;
