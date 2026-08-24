import { StyleSheet, View } from 'react-native';
import { Card, Divider, PriceRow, Text } from '@/components/ui';
import { formatMoney, lineTotal } from '@/domain/money';
import { theme } from '@/theme';
import type { CartItem, Order, OrderType } from '@/types';

/**
 * The order summary.
 *
 * <p>It takes EITHER the device's cart or a server-created order, and the distinction is the point:
 * before the order exists these are the app's own estimated figures, and the moment it exists the
 * server's numbers replace them. Server prices are authoritative — the browser's arithmetic is
 * only ever a preview.
 */
export function OrderSummary({
  items,
  orderType,
  totals,
  order,
}: {
  items: CartItem[];
  orderType: OrderType;
  totals: { subtotal: number; tax: number; deliveryFee: number; total: number };
  /** Once set, everything below comes from the server instead. */
  order?: Order | null;
}) {
  const money = order
    ? {
        subtotal: order.subtotal,
        tax: order.tax,
        deliveryFee: order.deliveryFee,
        total: order.total,
      }
    : totals;

  return (
    <Card testID="order-summary">
      <Text variant="label" tone="muted">
        Order summary · {orderType.toLowerCase()}
      </Text>

      <View style={styles.lines}>
        {order
          ? order.items.map((item) => (
              <SummaryLine
                key={item.id}
                quantity={item.quantity}
                name={item.productName}
                detail={detailOf(item.size, item.crustName)}
                amount={item.lineTotal}
              />
            ))
          : items.map((item) => (
              <SummaryLine
                key={item.lineId}
                quantity={item.quantity}
                name={item.productName}
                detail={detailOf(item.size, item.crustName)}
                amount={lineTotal(item)}
              />
            ))}
      </View>

      <Divider />

      <PriceRow label="Subtotal" amount={money.subtotal} />
      <PriceRow label="Tax" amount={money.tax} />
      {money.deliveryFee > 0 ? <PriceRow label="Delivery" amount={money.deliveryFee} /> : null}
      <PriceRow label="Total" amount={money.total} emphasis testID="checkout-total" />
    </Card>
  );
}

function detailOf(size: string, crustName: string | null): string {
  const sizeLabel = size.toLowerCase();
  return crustName ? `${sizeLabel}, ${crustName}` : sizeLabel;
}

function SummaryLine({
  quantity,
  name,
  detail,
  amount,
}: {
  quantity: number;
  name: string;
  detail: string;
  amount: number;
}) {
  return (
    <View style={styles.line}>
      <Text variant="caption" style={styles.lineLabel} numberOfLines={2}>
        {quantity} × {name}
        <Text variant="caption" tone="muted">{` (${detail})`}</Text>
      </Text>
      <Text variant="caption">{formatMoney(amount)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lines: { marginTop: theme.spacing.md, gap: theme.spacing.xs },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md },
  lineLabel: { flex: 1 },
});
