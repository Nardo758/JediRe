import { useAppStore } from '@/store';
import type { PlatformRole } from '@/types';

/**
 * useUserRole — returns the current user's platform role.
 * Defaults to 'sponsor' when the user is not yet loaded or the field is absent
 * (backward compat with pre-#878 user records).
 */
export function useUserRole(): PlatformRole {
  const { user } = useAppStore();
  const role = (user as any)?.platformRole;
  if (role === 'lp' || role === 'lender') return role;
  return 'sponsor';
}
