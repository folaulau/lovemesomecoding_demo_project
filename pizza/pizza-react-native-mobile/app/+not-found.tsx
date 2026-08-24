import { useRouter } from 'expo-router';
import { EmptyState, Screen } from '@/components/ui';

/**
 * `+not-found` is Expo Router's catch-all. It matters more on a phone than on the web: a deep link
 * or a push notification can point anywhere, including at a screen a newer build removed.
 */
export default function NotFoundRoute() {
  const router = useRouter();

  return (
    <Screen>
      <EmptyState
        emoji="🤷"
        title="Page not found"
        message="That screen does not exist in this build."
        actionLabel="Go home"
        onAction={() => router.replace('/')}
      />
    </Screen>
  );
}
