import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Screen, Text } from '@/components/ui';
import { useMenu } from '@/features/menu/state/MenuProvider';
import { useAuth } from '@/features/auth/state/AuthProvider';
import { formatMoney } from '@/domain/money';
import { theme } from '@/theme';

/** The landing screen — a hero, the delivery/pickup pitch, and a shortcut into the menu. */
export function HomeScreen() {
  const router = useRouter();
  const { pizzas, loading } = useMenu();
  const { user } = useAuth();

  const cheapestPizza = pizzas
    .flatMap((pizza) => pizza.sizes.map((size) => size.price))
    .reduce<number | null>((min, price) => (min === null || price < min ? price : min), null);

  return (
    <Screen testID="home-screen">
      <View style={styles.hero}>
        <Text style={styles.heroEmoji} accessibilityElementsHidden importantForAccessibility="no">
          🍕
        </Text>
        <Text variant="display" tone="inverse" center>
          StayHub Pizza
        </Text>
        <Text variant="body" tone="inverse" center style={styles.heroCopy}>
          {user?.fullName ? `Welcome back, ${user.fullName.split(' ')[0]}. ` : ''}
          Hot, fast, and built exactly how you want it.
        </Text>
        <Button
          title="Start your order"
          onPress={() => router.push('/menu')}
          size="lg"
          fullWidth
          style={styles.heroCta}
          testID="home-start-order"
        />
      </View>

      <View style={styles.cards}>
        <Card>
          <Text variant="label" tone="muted">
            Delivery
          </Text>
          <Text variant="subheading" style={styles.cardTitle}>
            To your door in ~30 min
          </Text>
          <Text variant="caption" tone="muted">
            A {formatMoney(3.99)} delivery fee applies. Pickup is always free.
          </Text>
        </Card>

        <Card>
          <Text variant="label" tone="muted">
            Build your own
          </Text>
          <Text variant="subheading" style={styles.cardTitle}>
            {loading ? 'Loading the menu…' : `${pizzas.length} pizzas, your toppings`}
          </Text>
          <Text variant="caption" tone="muted">
            {cheapestPizza !== null
              ? `Starting at ${formatMoney(cheapestPizza)}.`
              : 'Pick a size, a crust and as many toppings as you like.'}
          </Text>
          <Button
            title="Browse the menu"
            variant="outline"
            size="sm"
            onPress={() => router.push('/menu?type=PIZZA')}
            style={styles.cardCta}
          />
        </Card>
      </View>

      {/*
        The demo credentials. Acceptable ONLY because they are throwaway local fixtures — if this
        ever points at real data, this block is the first thing to delete.
      */}
      <Card style={styles.demoCard}>
        <Text variant="label" tone="muted">
          Demo logins
        </Text>
        <Text variant="caption" tone="muted" style={styles.cardTitle}>
          customer@pizza.test · pizza123
        </Text>
        <Text variant="caption" tone="muted">
          Test card 4242 4242 4242 4242, any future expiry, any CVC.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: theme.colors.surfaceInverse,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  heroEmoji: { fontSize: 52, marginBottom: theme.spacing.sm },
  heroCopy: { marginTop: theme.spacing.sm, opacity: 0.85 },
  heroCta: { marginTop: theme.spacing.xl },
  cards: { gap: theme.spacing.md, marginTop: theme.spacing.lg },
  cardTitle: { marginTop: 2, marginBottom: theme.spacing.xs },
  cardCta: { marginTop: theme.spacing.md, alignSelf: 'flex-start' },
  demoCard: { marginTop: theme.spacing.md, backgroundColor: theme.colors.surfaceAlt },
});
