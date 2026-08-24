import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, EmptyState, ErrorState, LoadingState, Text } from '@/components/ui';
import { OrderStatusBadge } from '../components/OrderStatusBadge';
import { orderApi, toUserMessage } from '@/api';
import { formatMoney } from '@/domain/money';
import { useAuth } from '@/features/auth/state/AuthProvider';
import { theme } from '@/theme';
import type { Order } from '@/types';

/** The signed-in customer's order history. */
export function OrdersScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
   * A counter, not a boolean. Incrementing it re-runs the effect below — which is how both the
   * first load and every pull-to-refresh go through exactly one code path. The same trick the
   * menu provider uses for its retry.
   */
  const [reloadToken, setReloadToken] = useState(0);

  /*
   * The fetch is defined INSIDE the effect rather than hoisted into a `useCallback`.
   *
   * That is deliberate. A function declared outside and called from an effect is, as far as the
   * linter and the React Compiler can see, a synchronous call that sets state — a cascading render.
   * Declaring it here makes the ownership obvious, keeps the AbortController in scope, and means
   * there is no dependency to get wrong.
   */
  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const page = await orderApi.listMine(0, 20, controller.signal);
        if (controller.signal.aborted) return;
        setOrders(page.content);
        setError(null);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(toUserMessage(err, 'Could not load your orders.'));
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    void load();
    return () => controller.abort();
  }, [reloadToken]);

  /*
   * Pull-to-refresh. There is no browser reload button on a phone, so a list that fetches once and
   * never again is a list the customer cannot fix. FlatList has this built in via `refreshing` and
   * `onRefresh` — one of the clearest wins of using it over a ScrollView.
   */
  const handleRefresh = useCallback(() => {
    // An event handler, so setting state synchronously here is exactly right.
    setRefreshing(true);
    setReloadToken((token) => token + 1);
  }, []);

  if (loading) {
    return <LoadingState label="Loading your orders…" />;
  }

  return (
    <View style={styles.root} testID="orders-screen">
      <FlatList
        data={orders}
        keyExtractor={(order) => order.id}
        contentContainerStyle={styles.content}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text variant="title">My orders</Text>
            {user?.email ? (
              <Text variant="caption" tone="muted">
                {user.email}
              </Text>
            ) : null}
            {error ? <ErrorState message={error} onRetry={handleRefresh} /> : null}
          </View>
        }
        ListEmptyComponent={
          error ? null : (
            <EmptyState
              emoji="🧾"
              title="No orders yet"
              message="Your past orders will appear here."
              actionLabel="Browse the menu"
              onAction={() => router.push('/menu')}
            />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/order/${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Order ${item.id.slice(0, 8)}, ${item.status.replace(/_/g, ' ').toLowerCase()}, ${formatMoney(item.total)}`}
            testID={`order-row-${item.id}`}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Card style={styles.orderCard}>
              <View style={styles.orderTop}>
                <Text variant="mono" tone="muted">
                  {item.id.slice(0, 8)}…
                </Text>
                <OrderStatusBadge status={item.status} />
              </View>

              <View style={styles.orderBottom}>
                <Text variant="caption" tone="muted">
                  {/*
                    `toLocaleDateString` with no locale uses the DEVICE's locale, which is what a
                    customer expects — unlike the API's ISO timestamp.
                  */}
                  {new Date(item.createdAt).toLocaleDateString()} · {item.orderType.toLowerCase()}
                </Text>
                <Text variant="bodyStrong">{formatMoney(item.total)}</Text>
              </View>
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.md },
  header: { gap: theme.spacing.xs, marginBottom: theme.spacing.xs },
  orderCard: { gap: theme.spacing.sm },
  orderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pressed: { opacity: 0.8 },
});
