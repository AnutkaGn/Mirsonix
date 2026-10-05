import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { refreshSession } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { authApi } from './api';

/** Restores the session after a page load from the refresh cookie. Runs once at app start. */
export function useBootstrapSession() {
  useEffect(() => {
    if (useAuthStore.getState().status === 'unknown') void refreshSession();
  }, []);
}

export function useLogin() {
  return useMutation({ mutationFn: authApi.login });
}

export function useRegister() {
  return useMutation({ mutationFn: authApi.register });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout,
    // Anything cached for the previous user (library, progress) must not survive a logout.
    onSettled: () => queryClient.clear(),
  });
}
