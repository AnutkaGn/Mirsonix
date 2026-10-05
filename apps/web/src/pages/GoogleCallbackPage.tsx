import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { refreshSession } from '@/lib/api-client';

/** Google returns here after the API has set the refresh cookie; trade it for an in-memory session. */
export function GoogleCallbackPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useEffect(() => {
    void refreshSession().then((ok) => navigate(ok ? '/' : '/login?error=google_failed', { replace: true }));
  }, [navigate]);
  return <p className="text-muted-foreground">{t('auth.signingIn')}</p>;
}
