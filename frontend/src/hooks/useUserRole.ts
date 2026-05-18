import { useAppStore } from '@/store';
import type { PlatformRole } from '@/types';

/**
 * useUserRole — returns the current user's platform role.
 * Defaults to 'sponsor' when the user is not yet loaded or the field is absent
 * (backward compat with pre-#878 user records).
 *
 * The store types `user` as `User | null`; `User` has `platformRole?: PlatformRole`,
 * so no `any` cast is required.
 */
export function useUserRole(): PlatformRole {
  const user = useAppStore((s) => s.user);
  const role = user?.platformRole;
  if (role === 'lp' || role === 'lender') return role;
  return 'sponsor';
}
