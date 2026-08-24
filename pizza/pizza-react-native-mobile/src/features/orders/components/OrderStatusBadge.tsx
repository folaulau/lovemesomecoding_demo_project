import { Badge, type BadgeTone } from '@/components/ui';
import type { OrderStatus } from '@/types';

/**
 * Status → colour, as an exhaustive record.
 *
 * <p>`Record<OrderStatus, …>` is what makes this safe: add a status to the union in types/order.ts
 * and this object stops compiling until it is handled. A lookup with a `?? 'neutral'` fallback
 * would compile happily and quietly render every new status grey.
 */
const STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  PENDING_PAYMENT: 'warning',
  PAID: 'primary',
  PREPARING: 'info',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge label={status.replace(/_/g, ' ').toLowerCase()} tone={STATUS_TONE[status]} />;
}
