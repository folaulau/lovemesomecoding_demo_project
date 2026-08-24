import { useLocalSearchParams } from 'expo-router';
import { EmptyState, Screen } from '@/components/ui';
import { OrderConfirmationScreen } from '@/features/orders/screens/OrderConfirmationScreen';

/**
 * `[orderId]` in the filename declares a dynamic segment — this route is `/order/:orderId`.
 *
 * <p>`useLocalSearchParams` reads it. The param is typed `string | string[] | undefined`, not
 * `string`, and that is honest rather than pedantic: a malformed deep link can genuinely arrive
 * without one, and the guard below is what turns that into a message instead of a crash.
 */
export default function OrderRoute() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();

  if (!orderId) {
    return (
      <Screen>
        <EmptyState
          emoji="🧾"
          title="Order not found"
          message="That link is missing an order id."
        />
      </Screen>
    );
  }

  return <OrderConfirmationScreen orderId={orderId} />;
}
