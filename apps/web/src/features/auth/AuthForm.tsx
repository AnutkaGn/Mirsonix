import { loginSchema, registerSchema } from '@mirsonix/shared';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiRequestError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { authApi } from './api';
import { useLogin, useRegister } from './hooks';

type Mode = 'login' | 'register';

export function AuthForm({ mode }: { mode: Mode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const login = useLogin();
  const register = useRegister();
  const mutation = mode === 'login' ? login : register;
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(
    params.get('error') ? t('auth.errors.google') : null,
  );

  const destination = (location.state as { from?: string } | null)?.from ?? '/';

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const raw = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    if (!raw.displayName) delete raw.displayName;

    const parsed = (mode === 'login' ? loginSchema : registerSchema).safeParse(raw);
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setFieldErrors({});
    try {
      await (mode === 'login' ? login.mutateAsync(parsed.data) : register.mutateAsync(parsed.data));
      navigate(destination, { replace: true });
    } catch (error) {
      const status = error instanceof ApiRequestError ? error.status : 0;
      setFormError(t(`auth.errors.${status === 401 ? 'credentials' : status === 409 ? 'taken' : status === 429 ? 'tooMany' : 'generic'}`));
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-semibold">{t(`auth.${mode}.title`)}</h1>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {mode === 'register' && (
          <Field label={t('auth.name')} error={fieldErrors.displayName}>
            <Input name="displayName" autoComplete="name" />
          </Field>
        )}
        <Field label={t('auth.email')} error={fieldErrors.email}>
          <Input name="email" type="email" autoComplete="email" />
        </Field>
        <Field label={t('auth.password')} error={fieldErrors.password}>
          <Input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </Field>

        {formError && <p role="alert" className="text-sm text-red-500">{formError}</p>}

        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {t(`auth.${mode}.submit`)}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {t('auth.or')}
        <span className="h-px flex-1 bg-border" />
      </div>

      <a href={authApi.googleUrl} className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}>
        {t('auth.google')}
      </a>

      <p className="text-center text-sm text-muted-foreground">
        {t(`auth.${mode}.switchPrompt`)}{' '}
        <Link to={mode === 'login' ? '/register' : '/login'} className="text-primary underline">
          {t(`auth.${mode}.switchAction`)}
        </Link>
      </p>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span>{label}</span>
      {children}
      {error && <span className="block text-xs text-red-500">{error}</span>}
    </label>
  );
}
