import type { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { EmptyState, Screen } from '@/components/ui';
import { useAuth } from '../state/AuthProvider';

/**
 * Gates a tab behind sign-in.
 *
 * <p>It renders a prompt rather than redirecting, which is the deliberate difference from the web
 * app's `<ProtectedRoute>`. Redirecting out of a TAB is disorienting: the customer taps "Orders",
 * lands on a login screen, and the tab they tapped is no longer the selected one. Showing the
 * prompt inside the tab keeps the navigation state honest.
 *
 * <p>This is a convenience, not a security control. The API resolves the owner from the token and
 * returns 404 for anything that is not theirs — a patched app that skipped this component would
 * see nothing it should not.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  if (isAuthenticated) return <>{children}</>;

  return (
    <Screen>
      <EmptyState
        emoji="🔒"
        title="Sign in to see this"
        message="Ordering never requires an account — this is just where your saved details live."
        actionLabel="Sign in"
        onAction={() => router.push('/login')}
      />
    </Screen>
  );
}
