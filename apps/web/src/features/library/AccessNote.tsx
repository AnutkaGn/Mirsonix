import type { AccessInfo } from '@mirsonix/shared';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/lib/format';
import { describeAccess } from './access';

/** One line on where access stands: renews on, ends on, included. */
export function AccessNote({ access, className }: { access: AccessInfo; className?: string }) {
  const { t } = useTranslation();
  const { key, date } = describeAccess(access);
  return <p className={className ?? 'text-xs text-muted-foreground'}>{t(`library.access.${key}`, { date: date ? formatDate(date) : '' })}</p>;
}
