import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { theme } from '@/theme';

export interface Segment<T extends string> {
  value: T;
  label: string;
  subtitle?: string;
}

/**
 * A row of mutually exclusive options — delivery vs pickup, and the menu's type filter.
 *
 * <p>Generic over the value type so `onChange` hands back `'DELIVERY' | 'CARRYOUT'` rather than a
 * bare `string`. That is what stops a typo in a call site from compiling.
 *
 * <p>`accessibilityRole="radio"` plus `checked` is the part people skip. Without it VoiceOver reads
 * two unrelated buttons instead of "Delivery, selected, 1 of 2".
 */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  testIDPrefix,
}: {
  segments: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  testIDPrefix?: string;
}) {
  return (
    <View style={styles.group} accessibilityRole="radiogroup">
      {segments.map((segment) => {
        const active = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            onPress={() => onChange(segment.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={segment.label}
            testID={testIDPrefix ? `${testIDPrefix}-${segment.value}` : undefined}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text variant="bodyStrong" style={active ? styles.labelActive : styles.label}>
              {segment.label}
            </Text>
            {segment.subtitle ? (
              <Text variant="caption" style={active ? styles.subtitleActive : styles.subtitle}>
                {segment.subtitle}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.sm,
  },
  segmentActive: { backgroundColor: theme.colors.primary },
  label: { color: theme.colors.textMuted },
  labelActive: { color: theme.colors.onPrimary },
  subtitle: { color: theme.colors.textSubtle },
  subtitleActive: { color: theme.colors.onPrimaryMuted },
});
