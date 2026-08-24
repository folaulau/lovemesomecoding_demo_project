import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { theme } from '@/theme';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'info';

/** A small pill of status text — order status, "primary" on an address, a topping name. */
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  return (
    <View style={[styles.badge, backgrounds[tone]]}>
      <Text variant="caption" style={[styles.label, foregrounds[tone]]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
    alignSelf: 'flex-start',
  },
  label: { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.semibold },
});

const backgrounds = StyleSheet.create({
  neutral: { backgroundColor: theme.colors.surfaceAlt },
  primary: { backgroundColor: theme.colors.primarySoft },
  success: { backgroundColor: theme.colors.successSoft },
  warning: { backgroundColor: theme.colors.warningSoft },
  info: { backgroundColor: theme.colors.infoSoft },
});

const foregrounds = StyleSheet.create({
  neutral: { color: theme.colors.textMuted },
  primary: { color: theme.colors.primary },
  success: { color: theme.colors.success },
  warning: { color: theme.colors.warning },
  info: { color: theme.colors.info },
});
