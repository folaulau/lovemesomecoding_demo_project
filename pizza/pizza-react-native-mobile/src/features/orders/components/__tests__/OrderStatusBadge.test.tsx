import { render, screen } from '@testing-library/react-native';
import { OrderStatusBadge } from '../OrderStatusBadge';
import type { OrderStatus } from '@/types';

describe('OrderStatusBadge', () => {
  it.each<[OrderStatus, string]>([
    ['PENDING_PAYMENT', 'pending payment'],
    ['PAID', 'paid'],
    ['PREPARING', 'preparing'],
    ['COMPLETED', 'completed'],
    ['CANCELLED', 'cancelled'],
  ])('renders %s as %p', async (status, label) => {
    await render(<OrderStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeTruthy();
  });
});
