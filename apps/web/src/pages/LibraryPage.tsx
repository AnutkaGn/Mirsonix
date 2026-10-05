import { useTranslation } from 'react-i18next';

/** Placeholder until Step 5/6 (billing + library). */
export function LibraryPage() {
  const { t } = useTranslation();
  return <h1 className="text-2xl font-semibold">{t('nav.library')}</h1>;
}
