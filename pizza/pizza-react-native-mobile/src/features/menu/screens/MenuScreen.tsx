import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SegmentedControl,
  Screen,
  Text,
} from '@/components/ui';
import { ProductCard } from '../components/ProductCard';
import { PizzaBuilderSheet } from '../components/PizzaBuilderSheet';
import { useMenu } from '../state/MenuProvider';
import { theme } from '@/theme';
import type { Product, ProductType } from '@/types';

type Filter = 'ALL' | ProductType;

const FILTERS = [
  { value: 'ALL' as const, label: 'Everything' },
  { value: 'PIZZA' as const, label: 'Pizzas' },
  { value: 'DRINK' as const, label: 'Drinks' },
];

export function MenuScreen() {
  /*
   * EXPO ROUTER CONCEPT: the URL is state.
   *
   * The active filter lives in the route's query params rather than in component state, exactly as
   * the web app puts it in `?type=PIZZA`. On a phone that still earns its keep: a deep link
   * (pizzaapp://menu?type=PIZZA) opens on the right tab, and the filter survives the screen being
   * dropped from memory and rebuilt when the customer returns to it.
   */
  const params = useLocalSearchParams<{ type?: string }>();
  const router = useRouter();
  const activeFilter: Filter = isFilter(params.type) ? params.type : 'ALL';

  const { products, loading, error, reload } = useMenu();

  // `null` means the sheet is closed. One piece of state, not two.
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  /*
   * A monotonic counter used as the builder's `key`, so each open mounts a component with fresh
   * state instead of an effect resetting the previous pizza's toppings. See PizzaBuilderSheet.
   *
   * It is incremented in an event handler, which is where state updates belong.
   */
  const [openCount, setOpenCount] = useState(0);

  const visibleProducts = useMemo(() => {
    if (activeFilter === 'ALL') return products;
    return products.filter((product) => product.type === activeFilter);
  }, [activeFilter, products]);

  /*
   * REACT CONCEPT: useCallback.
   *
   * ProductCard is wrapped in memo, which compares props by reference. Passing an inline arrow
   * here would create a new function on every render, so every card would see a "changed" prop and
   * re-render — memo would do nothing but waste a comparison.
   */
  const handleSelect = useCallback((product: Product) => {
    setSelectedProduct(product);
    setOpenCount((count) => count + 1);
  }, []);

  const handleFilter = useCallback(
    (filter: Filter) => {
      // `replace`, not `push`: changing a filter is not a place in history to go back to.
      router.replace(filter === 'ALL' ? '/menu' : `/menu?type=${filter}`);
    },
    [router],
  );

  if (loading) {
    return (
      <Screen>
        <LoadingState label="Loading the menu…" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <ErrorState message={error} onRetry={reload} />
      </Screen>
    );
  }

  return (
    <View style={styles.root} testID="menu-screen">
      {/*
        FlatList, not ScrollView + map.
        
        FlatList VIRTUALISES: it mounts only the rows near the viewport and recycles the rest. With
        a dozen products the difference is invisible, but the habit is what keeps a 500-item list
        from taking two seconds to open and holding 500 views in memory. `ScrollView` renders every
        child immediately, always.
      */}
      <FlatList
        data={visibleProducts}
        keyExtractor={(product) => product.id}
        numColumns={2}
        // `key` forces a fresh list if numColumns ever changes — FlatList cannot change it in place.
        key="two-column"
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text variant="title">Menu</Text>
            <SegmentedControl
              segments={FILTERS}
              value={activeFilter}
              onChange={handleFilter}
              testIDPrefix="menu-filter"
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyState title="Nothing here yet" message="No products match this filter." />
        }
        renderItem={({ item }) => <ProductCard product={item} onSelect={handleSelect} />}
        showsVerticalScrollIndicator={false}
      />

      <PizzaBuilderSheet
        key={openCount}
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </View>
  );
}

/** A type guard, so the query param narrows to `Filter` instead of being cast. */
function isFilter(value: string | undefined): value is Filter {
  return value === 'ALL' || value === 'PIZZA' || value === 'DRINK';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxxl, gap: theme.spacing.md },
  column: { gap: theme.spacing.md },
  header: { gap: theme.spacing.md, marginBottom: theme.spacing.xs },
});
