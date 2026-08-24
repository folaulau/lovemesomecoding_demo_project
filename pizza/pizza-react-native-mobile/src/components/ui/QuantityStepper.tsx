import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { theme } from '@/theme';

/**
 * A −/n/+ control.
 *
 * <p>Every touch target is at least 40dp square, which is why the buttons look larger than the web
 * app's. On a phone a 24px button is a miss, not a tap.
 */
export function QuantityStepper({
  quantity,
  onChange,
  itemName,
  min = 0,
  max = 20,
}: {
  quantity: number;
  onChange: (quantity: number) => void;
  /** Used to build a distinguishable screen-reader label — "Increase quantity of Pepperoni". */
  itemName: string;
  min?: number;
  max?: number;
}) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onChange(quantity - 1)}
        disabled={quantity <= min}
        accessibilityRole="button"
        accessibilityLabel={`Decrease quantity of ${itemName}`}
        style={({ pressed }) => [styles.button, pressed && styles.pressed, quantity <= min && styles.disabled]}
      >
        {/* U+2212 MINUS SIGN, not a hyphen — it optically matches the plus. */}
        <Text variant="subheading">−</Text>
      </Pressable>

      <View style={styles.readout} accessibilityLabel={`Quantity ${quantity}`}>
        <Text variant="bodyStrong">{quantity}</Text>
      </View>

      <Pressable
        onPress={() => onChange(quantity + 1)}
        disabled={quantity >= max}
        accessibilityRole="button"
        accessibilityLabel={`Increase quantity of ${itemName}`}
        style={({ pressed }) => [styles.button, pressed && styles.pressed, quantity >= max && styles.disabled]}
      >
        <Text variant="subheading">+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  button: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
  },
  pressed: { backgroundColor: theme.colors.surfaceAlt },
  disabled: { opacity: 0.4 },
  readout: { minWidth: 44, alignItems: 'center' },
});
