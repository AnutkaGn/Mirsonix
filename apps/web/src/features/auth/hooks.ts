import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { refreshSession } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { usePlayerStore } from '@/features/player/player.store';
import { useProgressStore } from '@/features/player/progress.store';
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
    // Anything belonging to the previous user (cached library, the play queue) must not survive a logout.
    onSettled: () => {
      queryClient.clear();
      usePlayerStore.getState().clear();
      useProgressStore.getState().reset();
    },
  });
}
