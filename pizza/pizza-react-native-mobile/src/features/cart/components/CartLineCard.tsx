import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Badge, QuantityStepper, Text } from '@/components/ui';
import { formatMoney, lineTotal, unitPrice } from '@/domain/money';
import { theme } from '@/theme';
import type { CartItem } from '@/types';

interface Props {
  item: CartItem;
  onQuantityChange: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string) => void;
}

/**
 * One line of the cart.
 *
 * <p>memo again, and for the same reason as ProductCard: changing one line's quantity re-renders
 * the provider, and without memo every other line re-renders with it.
 */
export const CartLineCard = memo(function CartLineCard({
  item,
  onQuantityChange,
  onRemove,
}: Props) {
  const sizeLabel = item.size.charAt(0) + item.size.slice(1).toLowerCase();

  return (
    <View style={styles.line} testID={`cart-line-${item.lineId}`}>
      <View style={styles.top}>
        <View style={styles.details}>
          <Text variant="bodyStrong">{item.productName}</Text>
          <Text variant="caption" tone="muted">
            {sizeLabel}
            {item.crustName ? ` · ${item.crustName}` : ''}
          </Text>

          {item.toppings.length > 0 ? (
            <View style={styles.toppings}>
              {item.toppings.map((topping) => (
                <Badge key={topping.id} label={topping.name} />
              ))}
            </View>
          ) : null}

          <Text variant="caption" tone="subtle" style={styles.unit}>
            {formatMoney(unitPrice(item))} each
          </Text>
        </View>

        <Text variant="bodyStrong" testID={`cart-line-total-${item.lineId}`}>
          {formatMoney(lineTotal(item))}
        </Text>
      </View>

      <View style={styles.controls}>
        <QuantityStepper
          quantity={item.quantity}
          onChange={(quantity) => onQuantityChange(item.lineId, quantity)}
          itemName={item.productName}
          min={0}
        />
        <Pressable
          onPress={() => onRemove(item.lineId)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.productName}`}
          testID={`cart-remove-${item.lineId}`}
        >
          <Text variant="caption" tone="danger" style={styles.remove}>
            Remove
          </Text>
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  line: {
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md },
  details: { flex: 1 },
  toppings: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: theme.spacing.xs },
  unit: { marginTop: theme.spacing.xs },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
  },
  remove: { fontWeight: theme.fontWeight.semibold },
});
