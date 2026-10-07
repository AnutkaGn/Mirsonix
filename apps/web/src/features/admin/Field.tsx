import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { FieldError } from './forms';

interface ControlProps {
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
}

/** A label, a control and its error, wired together for screen readers. */
export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: FieldError;
  hint?: string;
  children: (control: ControlProps) => ReactNode;
}) {
  const { t } = useTranslation();
  const id = useId();
  const messageId = `${id}-message`;
  const hasMessage = Boolean(error || hint);
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children({
        id,
        ...(error && { 'aria-invalid': true as const }),
        ...(hasMessage && { 'aria-describedby': messageId }),
      })}
      {hasMessage && (
        <p
          id={messageId}
          className={error ? 'text-xs text-red-500' : 'text-xs text-muted-foreground'}
        >
          {error ? t(`admin.form.errors.${error}`) : hint}
        </p>
      )}
    </div>
  );
}
