import { useCallback } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Button,
  Divider,
  EmptyState,
  PriceRow,
  SegmentedControl,
  Sheet,
  Text,
  type Segment,
} from '@/components/ui';
import { CartLineCard } from './CartLineCard';
import { useCart } from '../state/CartProvider';
import { theme } from '@/theme';
import type { OrderType } from '@/types';

const ORDER_TYPES: readonly Segment<OrderType>[] = [
  { value: 'DELIVERY', label: 'Delivery' },
  { value: 'CARRYOUT', label: 'Pickup' },
];

/**
 * The cart, in a bottom sheet.
 *
 * <p>The web app uses Bootstrap's Offcanvas, which slides in from the right. A phone has no room
 * for that: a bottom sheet is the platform-native shape, and it keeps the primary action within
 * thumb reach rather than at the top of the screen.
 */
export function CartSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { items, totals, orderType, setOrderType, setQuantity, removeItem } = useCart();
  const router = useRouter();

  /*
   * Stable identities, because CartLineCard is memoised. Defined here rather than inline in the
   * map for exactly the reason ProductCard's `onSelect` is.
   */
  const handleQuantityChange = useCallback(
    (lineId: string, quantity: number) => setQuantity(lineId, quantity),
    [setQuantity],
  );
  const handleRemove = useCallback((lineId: string) => removeItem(lineId), [removeItem]);

  function goToCheckout() {
    // Close first, then navigate: a sheet still mounted over a pushed screen blocks every tap.
    onClose();
    router.push('/checkout');
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Your order" testID="cart-sheet">
      <SegmentedControl
        segments={ORDER_TYPES}
        value={orderType}
        onChange={setOrderType}
        testIDPrefix="cart-order-type"
      />

      {items.length === 0 ? (
        <EmptyState title="Your cart is empty" message="Add a pizza to get started." />
      ) : (
        <>
          <ScrollView style={styles.lines} showsVerticalScrollIndicator={false}>
            {items.map((item) => (
              <CartLineCard
                key={item.lineId}
                item={item}
                onQuantityChange={handleQuantityChange}
                onRemove={handleRemove}
              />
            ))}
          </ScrollView>

          <Divider />

          <PriceRow label="Subtotal" amount={totals.subtotal} />
          <PriceRow label="Tax" amount={totals.tax} />
          {totals.deliveryFee > 0 ? (
            <PriceRow label="Delivery" amount={totals.deliveryFee} />
          ) : null}
          <PriceRow label="Total" amount={totals.total} emphasis testID="cart-total" />

          <Button
            title="Checkout"
            onPress={goToCheckout}
            fullWidth
            size="lg"
            style={styles.checkout}
            testID="cart-checkout"
          />

          <Text variant="caption" tone="subtle" center style={styles.disclaimer}>
            Prices are confirmed by the server at checkout.
          </Text>
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  // A cap, not a fixed height: a one-line cart should not leave a tall empty gap.
  lines: { maxHeight: 320, marginTop: theme.spacing.sm },
  checkout: { marginTop: theme.spacing.lg },
  disclaimer: { marginTop: theme.spacing.sm },
});
