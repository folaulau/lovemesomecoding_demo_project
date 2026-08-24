import { Pressable, StyleSheet, View } from 'react-native';
import { Badge, Text } from '@/components/ui';
import { theme } from '@/theme';
import type { Address } from '@/types';

/** The sentinel meaning "type a fresh address instead of using a saved one". */
export const NEW_ADDRESS = 'NEW';

/**
 * A radio list of the customer's saved addresses, plus a "different address" option.
 *
 * <p>Modelling "type a new one" as one of the SELECTION VALUES, rather than as a separate boolean,
 * keeps the group honest: exactly one option is selected at any time, and there is no state where
 * both a saved address and the form are considered active.
 *
 * <p>Guests never see this — they have no account, so there is nothing to load.
 */
export function SavedAddressPicker({
  addresses,
  selectedId,
  onSelect,
}: {
  addresses: Address[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  if (addresses.length === 0) return null;

  return (
    <View accessibilityRole="radiogroup" style={styles.group}>
      {addresses.map((address) => (
        <AddressOption
          key={address.id}
          selected={selectedId === address.id}
          onPress={() => onSelect(address.id)}
          testID={`address-${address.id}`}
          title={address.label || 'Address'}
          badge={address.primary ? 'primary' : undefined}
          subtitle={`${address.line1}, ${address.city}, ${address.state} ${address.postalCode}`}
        />
      ))}

      <AddressOption
        selected={selectedId === NEW_ADDRESS}
        onPress={() => onSelect(NEW_ADDRESS)}
        testID="address-new"
        title="Use a different address"
      />
    </View>
  );
}

function AddressOption({
  selected,
  onPress,
  title,
  subtitle,
  badge,
  testID,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  subtitle?: string;
  badge?: string;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionSelected,
        pressed && styles.optionPressed,
      ]}
    >
      {/*
        The radio dot is drawn, not supplied: React Native has no <input type="radio">. A circle
        with a smaller filled circle inside is the whole trick, and it is why the accessibility
        props above are not optional — nothing else tells a screen reader this is a radio.
      */}
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>

      <View style={styles.optionBody}>
        <View style={styles.titleRow}>
          <Text variant="bodyStrong">{title}</Text>
          {badge ? <Badge label={badge} tone="success" /> : null}
        </View>
        {subtitle ? (
          <Text variant="caption" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.sm,
    borderWidth: 1.5,
    borderColor: theme.colors.borderSubtle,
  },
  optionSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
  optionPressed: { opacity: 0.8 },
  optionBody: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioSelected: { borderColor: theme.colors.primary },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
});
