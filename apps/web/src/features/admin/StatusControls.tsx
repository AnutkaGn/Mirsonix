import type { ContentStatus } from '@mirsonix/shared';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function StatusBadge({ status }: { status: ContentStatus }) {
  const { t } = useTranslation();
  return (
    <Badge variant={status === 'PUBLISHED' ? 'default' : 'muted'}>
      {t(`admin.status.${status}`)}
    </Badge>
  );
}

interface StatusControlsProps {
  status: ContentStatus;
  busy: boolean;
  onPublish: () => void;
  onArchive: () => void;
}

/** Content moves DRAFT → PUBLISHED ⇄ ARCHIVED and never back to draft, so only the legal next step is offered. */
export function StatusControls({ status, busy, onPublish, onArchive }: StatusControlsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3">
      <StatusBadge status={status} />
      {status !== 'PUBLISHED' && (
        <Button type="button" size="sm" disabled={busy} onClick={onPublish}>
          {status === 'ARCHIVED' ? t('admin.actions.republish') : t('admin.actions.publish')}
        </Button>
      )}
      {status === 'PUBLISHED' && (
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onArchive}>
          {t('admin.actions.archive')}
        </Button>
      )}
    </div>
  );
}
