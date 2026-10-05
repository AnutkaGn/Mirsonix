import { useTranslation } from 'react-i18next';

export function AdminDashboardPage() {
  const { t } = useTranslation();
  return <h1 className="text-2xl font-semibold">{t('admin.dashboard')}</h1>;
}
