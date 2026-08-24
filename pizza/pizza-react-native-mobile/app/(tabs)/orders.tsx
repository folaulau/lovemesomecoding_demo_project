import { RequireAuth } from '@/features/auth/components/RequireAuth';
import { OrdersScreen } from '@/features/orders/screens/OrdersScreen';

export default function OrdersRoute() {
  return (
    <RequireAuth>
      <OrdersScreen />
    </RequireAuth>
  );
}
