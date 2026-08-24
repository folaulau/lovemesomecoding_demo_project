import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { useCart } from '../state/CartProvider';
import { theme } from '@/theme';

/**
 * The cart button that lives in the navigation header, with its item-count badge.
 *
 * <p>It reads `hydrated` as well as the count, because the saved cart is fetched asynchronously on
 * launch. Rendering "0" during that window and then popping to "3" is a small thing that makes an
 * app feel broken; showing no badge until the truth is known does not.
 */
export function CartHeaderButton({ onPress }: { onPress: () => void }) {
  const { totals, hydrated } = useCart();
  const count = totals.itemCount;
  const showBadge = hydrated && count > 0;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={
        showBadge ? `Open cart, ${count} ${count === 1 ? 'item' : 'items'}` : 'Open cart, empty'
      }
      testID="cart-button"
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.icon}>🛒</Text>
      {showBadge ? (
        <View style={styles.badge} testID="cart-badge">
          <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs },
  pressed: { opacity: 0.6 },
  icon: { fontSize: 22 },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: theme.colors.onPrimary,
    fontSize: 10,
    fontWeight: theme.fontWeight.bold,
  },
});
