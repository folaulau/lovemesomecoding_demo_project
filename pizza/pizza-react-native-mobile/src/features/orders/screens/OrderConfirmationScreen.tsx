import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Divider, ErrorState, LoadingState, PriceRow, Screen, Text } from '@/components/ui';
import { OrderStatusBadge } from '../components/OrderStatusBadge';
import { orderApi, toUserMessage } from '@/api';
import { formatMoney } from '@/domain/money';
import { theme } from '@/theme';
import type { Order } from '@/types';

/** How long to keep asking before giving up and telling the customer to check their email. */
const MAX_POLLS = 10;
const POLL_INTERVAL_MS = 2000;

export function OrderConfirmationScreen({ orderId }: { orderId: string }) {
  const router = useRouter();

  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A ref, not state: bumping the count must not trigger a re-render.
  const pollCount = useRef(0);

  /*
   * Poll /payment-status until the order leaves PENDING_PAYMENT.
   *
   * Why poll at all, when there is a webhook? Because a webhook does not reach a laptop unless
   * `stripe listen` is running, and even in production it can arrive seconds later than the
   * customer. That endpoint asks Stripe directly, so this screen is correct either way.
   *
   * The device is never the authority here: it only asks the server what the server believes.
   */
  useEffect(() => {
    if (!orderId) return;

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const fresh = await orderApi.paymentStatus(orderId, controller.signal);
        if (controller.signal.aborted) return;

        setOrder(fresh);
        setError(null);

        if (fresh.status !== 'PENDING_PAYMENT') return;

        pollCount.current += 1;
        if (pollCount.current >= MAX_POLLS) return;

        timer = setTimeout(poll, POLL_INTERVAL_MS);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(toUserMessage(err, 'Could not load the order.'));
      }
    }

    void poll();

    /*
     * Cleanup stops the loop when the customer navigates away. Without it the timer keeps firing
     * requests forever — and on a phone that is not just wasted work, it is battery and data.
     */
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [orderId]);

  if (!order && !error) {
    return (
      <Screen>
        <LoadingState label="Loading your order…" />
      </Screen>
    );
  }

  if (error && !order) {
    return (
      <Screen>
        <ErrorState message={error} />
      </Screen>
    );
  }

  if (!order) return null;

  const settling = order.status === 'PENDING_PAYMENT';

  return (
    <Screen testID="order-confirmation-screen">
      <View style={styles.hero}>
        <Text style={styles.emoji} accessibilityElementsHidden importantForAccessibility="no">
          🍕
        </Text>
        <Text variant="title" center>
          {settling ? 'Confirming your payment…' : 'Order confirmed'}
        </Text>
        <Text variant="mono" tone="muted" center style={styles.orderId} selectable>
          {order.id}
        </Text>
        <View style={styles.badge}>
          <OrderStatusBadge status={order.status} />
        </View>
        {settling ? (
          <Text variant="caption" tone="muted" center style={styles.settling}>
            Checking with the payment provider. This usually takes a few seconds.
          </Text>
        ) : null}
      </View>

      <Card style={styles.card}>
        <Text variant="label" tone="muted">
          {order.orderType === 'DELIVERY' ? 'Delivering to' : 'Pick up'}
        </Text>
        <Text variant="bodyStrong" style={styles.cardValue}>
          {order.customerName}
        </Text>
        {order.orderType === 'DELIVERY' && order.addressLine1 ? (
          <Text variant="caption" tone="muted">
            {order.addressLine1}
            {order.addressLine2 ? `, ${order.addressLine2}` : ''}
            {`\n${order.city}, ${order.state} ${order.postalCode}`}
          </Text>
        ) : (
          <Text variant="caption" tone="muted">
            Collect in store — no delivery fee.
          </Text>
        )}
        <Text variant="caption" tone="muted" style={styles.email}>
          Receipt to {order.email}
        </Text>
      </Card>

      <Card style={styles.card}>
        <Text variant="label" tone="muted">
          Items
        </Text>

        <View style={styles.items}>
          {order.items.map((item) => (
            <View key={item.id} style={styles.item}>
              <View style={styles.itemBody}>
                <Text variant="caption">
                  {item.quantity} × {item.productName}
                </Text>
                <Text variant="caption" tone="muted">
                  {item.size.toLowerCase()}
                  {item.crustName ? `, ${item.crustName}` : ''}
                  {item.toppings.length > 0
                    ? ` · ${item.toppings.map((topping) => topping.toppingName).join(', ')}`
                    : ''}
                </Text>
              </View>
              <Text variant="caption">{formatMoney(item.lineTotal)}</Text>
            </View>
          ))}
        </View>

        <Divider />

        {/* These are the SERVER's figures. They are the ones that count. */}
        <PriceRow label="Subtotal" amount={order.subtotal} />
        <PriceRow label="Tax" amount={order.tax} />
        {order.deliveryFee > 0 ? <PriceRow label="Delivery" amount={order.deliveryFee} /> : null}
        <PriceRow label="Total" amount={order.total} emphasis testID="confirmation-total" />

        {order.cardBrand && order.cardLast4 ? (
          <Text variant="caption" tone="muted" style={styles.card4}>
            Paid with {order.cardBrand} ending {order.cardLast4}
          </Text>
        ) : null}
      </Card>

      <Button
        title="Back to the menu"
        variant="outline"
        onPress={() => router.replace('/menu')}
        fullWidth
        style={styles.card}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: theme.spacing.lg },
  emoji: { fontSize: 52, marginBottom: theme.spacing.sm },
  orderId: { marginTop: theme.spacing.sm },
  badge: { marginTop: theme.spacing.md },
  settling: { marginTop: theme.spacing.md },
  card: { marginTop: theme.spacing.lg },
  cardValue: { marginTop: theme.spacing.xs, marginBottom: 2 },
  email: { marginTop: theme.spacing.sm },
  items: { marginTop: theme.spacing.md, gap: theme.spacing.sm },
  item: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md },
  itemBody: { flex: 1 },
  card4: { marginTop: theme.spacing.md },
});
