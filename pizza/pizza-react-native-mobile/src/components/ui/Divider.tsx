import { StyleSheet, View } from 'react-native';
import { theme } from '@/theme';

/**
 * A hairline rule.
 *
 * <p>`StyleSheet.hairlineWidth` rather than `1`: on a 3× screen a 1dp line is three physical pixels
 * and looks like a bar. This resolves to the thinnest line the display can actually draw.
 */
export function Divider({ spaced = true }: { spaced?: boolean }) {
  return <View style={[styles.rule, spaced && styles.spaced]} />;
}

const styles = StyleSheet.create({
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
  },
  spaced: { marginVertical: theme.spacing.md },
});
