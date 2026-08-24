import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Badge,
  Button,
  Chip,
  QuantityStepper,
  SegmentedControl,
  Sheet,
  Text,
  type Segment,
} from '@/components/ui';
import { formatMoney, round2 } from '@/domain/money';
import { useMenu } from '../state/MenuProvider';
import { useCart } from '@/features/cart/state/CartProvider';
import { useToast } from '@/providers/ToastProvider';
import { theme } from '@/theme';
import type { Crust, Product, SizeName, ToppingCategory } from '@/types';

const TOPPING_GROUPS: readonly { label: string; category: ToppingCategory }[] = [
  { label: 'Meats', category: 'MEAT' },
  { label: 'Veggies', category: 'VEGGIE' },
  { label: 'Cheeses', category: 'CHEESE' },
];

/**
 * Pick a size, a crust and toppings, and watch the price update live.
 *
 * <p>Drinks reuse this same sheet but only get the size step — one component rather than two
 * near-identical ones.
 */
export function PizzaBuilderSheet({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  // Crusts and toppings come from the API via context, not from a hard-coded list.
  const { crusts, toppings } = useMenu();
  const { addItem } = useCart();
  const { showToast } = useToast();

  /*
   * RESETTING STATE WHEN THE PRODUCT CHANGES — the interesting problem in this component.
   *
   * The obvious solution is an effect: "when `product` changes, call setSize('MEDIUM'), clear the
   * toppings…". It works, and it is wrong twice over. It renders once with the PREVIOUS pizza's
   * toppings before the effect corrects it, and it is a cascading render React has to throw away
   * (`react-hooks/set-state-in-effect` exists to catch exactly this).
   *
   * React's own answer is to reset state by REMOUNTING, with a `key`. The menu screen bumps a
   * counter each time a product is opened and passes it as this component's key, so every open
   * gets a component with fresh state — and the initialisers below simply read the props. No
   * effect, no intermediate render, and reopening the SAME pizza starts clean too.
   *
   * The key is the open counter rather than the product id on purpose: the id would change to
   * `undefined` on close and remount the sheet mid-animation, cutting the slide-out short.
   */
  const [size, setSize] = useState<SizeName>('MEDIUM');
  const [crustId, setCrustId] = useState<string | null>(() => crusts[0]?.id ?? null);
  const [selectedToppingIds, setSelectedToppingIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);

  const isPizza = product?.type === 'PIZZA';

  const sizeSegments = useMemo<readonly Segment<SizeName>[]>(
    () =>
      (product?.sizes ?? []).map((option) => ({
        value: option.size,
        // "MEDIUM" reads badly in a button; "Medium" does.
        label: option.size.charAt(0) + option.size.slice(1).toLowerCase(),
        subtitle: formatMoney(option.price),
      })),
    [product],
  );

  const crust: Crust | null = useMemo(
    () => (isPizza ? (crusts.find((c) => c.id === crustId) ?? null) : null),
    [isPizza, crustId, crusts],
  );

  const selectedToppings = useMemo(
    () => (isPizza ? toppings.filter((t) => selectedToppingIds.includes(t.id)) : []),
    [isPizza, selectedToppingIds, toppings],
  );

  /*
   * REACT CONCEPT: useMemo for derived values.
   *
   * The live price is recomputed only when something it depends on actually changes. This
   * particular sum is cheap; the pattern matters once the calculation is not.
   */
  const pricing = useMemo(() => {
    if (!product) return { unit: 0, total: 0 };

    const base = product.sizes.find((s) => s.size === size)?.price ?? 0;
    const toppingsTotal = selectedToppings.reduce((sum, t) => sum + t.price, 0);
    const unit = round2(base + (crust?.priceDelta ?? 0) + toppingsTotal);

    return { unit, total: round2(unit * quantity) };
  }, [product, size, crust, selectedToppings, quantity]);

  function toggleTopping(id: string) {
    setSelectedToppingIds((current) =>
      current.includes(id) ? current.filter((t) => t !== id) : [...current, id],
    );
  }

  function handleAdd() {
    if (!product) return;
    addItem({ product, size, crust, toppings: selectedToppings, quantity });
    showToast(`${quantity} × ${product.name} added to your cart`);
    onClose();
  }

  return (
    <Sheet
      visible={product !== null}
      onClose={onClose}
      title={product?.name ?? ''}
      testID="pizza-builder-sheet"
      footer={
        <View style={styles.footer}>
          <View>
            <Text variant="caption" tone="muted">
              {formatMoney(pricing.unit)} each
            </Text>
            <Text variant="heading" testID="builder-total">
              {formatMoney(pricing.total)}
            </Text>
          </View>
          <Button title="Add to cart" onPress={handleAdd} testID="builder-add" />
        </View>
      }
    >
      {/*
        A ScrollView inside the sheet, not around it: the header and the footer must stay put while
        a long topping list scrolls between them.
      */}
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {product?.description ? (
          <Text variant="caption" tone="muted" style={styles.description}>
            {product.description}
          </Text>
        ) : null}

        <Section title="Size">
          <SegmentedControl
            segments={sizeSegments}
            value={size}
            onChange={setSize}
            testIDPrefix="size"
          />
        </Section>

        {/* Crust and toppings only make sense for a pizza. */}
        {isPizza ? (
          <>
            <Section title="Crust">
              <View style={styles.chipRow}>
                {crusts.map((option) => (
                  <Chip
                    key={option.id}
                    label={option.name}
                    detail={
                      option.priceDelta > 0 ? `+${formatMoney(option.priceDelta)}` : undefined
                    }
                    selected={crustId === option.id}
                    onPress={() => setCrustId(option.id)}
                    testID={`crust-${option.id}`}
                  />
                ))}
              </View>
            </Section>

            <Section
              title="Toppings"
              accessory={
                selectedToppings.length > 0 ? (
                  <Badge label={`${selectedToppings.length} selected`} tone="primary" />
                ) : undefined
              }
            >
              {TOPPING_GROUPS.map((group) => {
                const inGroup = toppings.filter((t) => t.category === group.category);
                if (inGroup.length === 0) return null;

                return (
                  <View key={group.category} style={styles.group}>
                    <Text variant="caption" tone="muted" style={styles.groupLabel}>
                      {group.label}
                    </Text>
                    <View style={styles.chipRow}>
                      {inGroup.map((topping) => (
                        <Chip
                          key={topping.id}
                          label={topping.name}
                          detail={`+${formatMoney(topping.price)}`}
                          selected={selectedToppingIds.includes(topping.id)}
                          onPress={() => toggleTopping(topping.id)}
                          testID={`topping-${topping.id}`}
                        />
                      ))}
                    </View>
                  </View>
                );
              })}
            </Section>
          </>
        ) : null}

        <Section title="Quantity">
          <QuantityStepper
            quantity={quantity}
            onChange={setQuantity}
            itemName={product?.name ?? 'item'}
            min={1}
            max={10}
          />
        </Section>
      </ScrollView>
    </Sheet>
  );
}

/** A titled block. Local to this file because nothing else needs it — extract when it does. */
function Section({
  title,
  accessory,
  children,
}: {
  title: string;
  accessory?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text variant="label" tone="muted">
          {title}
        </Text>
        {accessory}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  description: { marginBottom: theme.spacing.lg },
  section: { marginBottom: theme.spacing.xl },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  group: { marginBottom: theme.spacing.md },
  groupLabel: { marginBottom: theme.spacing.xs, fontWeight: theme.fontWeight.semibold },
  /*
   * `flexWrap` plus `gap`. React Native's flexbox defaults differ from the web's in two ways worth
   * remembering: `flexDirection` defaults to 'column', not 'row', and `alignItems` defaults to
   * 'stretch'. Both bite constantly when porting CSS.
   */
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
