import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, Card } from '@/components/ui';
import { formatMoney } from '@/domain/money';
import { theme } from '@/theme';
import type { Product } from '@/types';

interface Props {
  product: Product;
  onSelect: (product: Product) => void;
}

/* ==========================================================================
 * REACT CONCEPT: memo
 *
 * memo skips re-rendering a component when its props are unchanged (compared shallowly).
 *
 * It matters here because the menu renders a card per product. Without memo, opening the cart sheet
 * — which changes state in a PARENT — would re-render every card even though not one of their props
 * changed. On a phone that is not a theoretical cost: the render happens on the JavaScript thread,
 * and dropped frames while a sheet animates are visible.
 *
 * memo only works if the props are referentially stable, which is exactly why the menu screen wraps
 * `onSelect` in useCallback. An inline arrow would be a new object every render and memo would
 * never hit — it would just add a comparison for nothing.
 *
 * Do not reach for memo by default. Use it for components that are numerous, expensive, or both.
 * ========================================================================== */
export const ProductCard = memo(function ProductCard({ product, onSelect }: Props) {
  /*
   * `noUncheckedIndexedAccess` makes `sizes[0]` possibly-undefined, which is the truth: a product
   * with no sizes is a valid API response. Math.min of an empty array is Infinity, so the guard
   * below is what stops "from $Infinity" reaching a customer.
   */
  const prices = product.sizes.map((size) => size.price);
  const cheapest = prices.length > 0 ? Math.min(...prices) : null;
  const isPizza = product.type === 'PIZZA';

  return (
    <Pressable
      onPress={() => onSelect(product)}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}. ${cheapest !== null ? `From ${formatMoney(cheapest)}.` : ''} ${isPizza ? 'Build it' : 'Add to cart'}`}
      testID={`product-card-${product.id}`}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      <Card style={styles.card}>
        <View style={styles.thumb} accessibilityElementsHidden importantForAccessibility="no">
          <Text style={styles.emoji}>{isPizza ? '🍕' : '🥤'}</Text>
        </View>

        <View style={styles.body}>
          <Text variant="subheading" numberOfLines={1}>
            {product.name}
          </Text>
          {/*
            `numberOfLines` is the native answer to CSS `text-overflow: ellipsis`. Without it a
            long description pushes the price row down and the grid stops lining up — there is no
            `overflow: hidden` to fall back on.
          */}
          <Text variant="caption" tone="muted" numberOfLines={2} style={styles.description}>
            {product.description}
          </Text>

          <View style={styles.footer}>
            {cheapest !== null ? (
              <Text variant="caption" tone="muted">
                from{' '}
                <Text variant="bodyStrong" tone="primary">
                  {formatMoney(cheapest)}
                </Text>
              </Text>
            ) : (
              <Text variant="caption" tone="subtle">
                Unavailable
              </Text>
            )}
            <Text variant="caption" tone="primary" style={styles.cta}>
              {isPizza ? 'Build it →' : 'Add →'}
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  pressable: { flex: 1 },
  pressed: { opacity: 0.8 },
  card: { padding: 0, overflow: 'hidden', flex: 1 },
  thumb: {
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  emoji: { fontSize: 40 },
  body: { padding: theme.spacing.md, flex: 1 },
  description: { marginTop: 2, minHeight: 34 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  cta: { fontWeight: theme.fontWeight.semibold },
});
