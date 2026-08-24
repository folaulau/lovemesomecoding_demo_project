import { Pressable, StyleSheet } from 'react-native';
import { Text } from './Text';
import { theme } from '@/theme';

/** A toggleable pill — one topping in the builder. The web app's `.topping-chip`. */
export function Chip({
  label,
  detail,
  selected,
  onPress,
  testID,
}: {
  label: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.chipPressed,
      ]}
    >
      <Text variant="caption" style={selected ? styles.labelSelected : styles.label}>
        {label}
        {detail ? <Text variant="caption" style={styles.detail}>{`  ${detail}`}</Text> : null}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  chipSelected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipPressed: { opacity: 0.7 },
  label: { color: theme.colors.text, fontWeight: theme.fontWeight.medium },
  labelSelected: { color: theme.colors.onPrimary, fontWeight: theme.fontWeight.semibold },
  detail: { opacity: 0.7 },
});
