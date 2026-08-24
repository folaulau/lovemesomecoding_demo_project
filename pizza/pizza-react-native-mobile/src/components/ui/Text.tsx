import { StyleSheet, Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { theme } from '@/theme';

/**
 * Typography, as a closed set.
 *
 * <p>React Native's `<Text>` inherits nothing — a font size set on a parent `<View>` reaches no
 * child, and even nested `<Text>` only inherits on iOS. So every piece of text on every screen has
 * to name its own size and weight. Doing that inline produces a hundred slightly different
 * greys.
 *
 * <p>Naming the variants here is the native equivalent of Bootstrap's `.h5`, `.small` and
 * `.text-muted` utility classes, and it means a typographic change happens in one file.
 */
export type TextVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'bodyStrong'
  | 'label'
  | 'caption'
  | 'mono';

export type TextTone =
  'default' | 'muted' | 'subtle' | 'primary' | 'inverse' | 'danger' | 'success';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  tone?: TextTone;
  center?: boolean;
}

export function Text({
  variant = 'body',
  tone = 'default',
  center = false,
  style,
  ...rest
}: TextProps) {
  return (
    <RNText
      // Order matters: the caller's `style` comes last so a one-off override still wins.
      style={[styles[variant], toneStyles[tone], center && styles.center, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  display: {
    fontSize: theme.fontSize.display,
    fontWeight: theme.fontWeight.heavy,
    letterSpacing: -1,
  },
  title: { fontSize: theme.fontSize.xxl, fontWeight: theme.fontWeight.heavy, letterSpacing: -0.5 },
  heading: { fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold },
  subheading: { fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.semibold },
  body: { fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.regular, lineHeight: 21 },
  bodyStrong: { fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold },
  /** Small, uppercase section headers — the web app's `.text-uppercase.text-muted.h6`. */
  label: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  caption: { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.regular },
  /** `fontFamily` is one of the few genuinely platform-specific style values left. */
  mono: {
    fontSize: theme.fontSize.sm,
    fontFamily: process.env['EXPO_OS'] === 'ios' ? 'Menlo' : 'monospace',
  },
  center: { textAlign: 'center' },
});

const toneStyles = StyleSheet.create({
  default: { color: theme.colors.text },
  muted: { color: theme.colors.textMuted },
  subtle: { color: theme.colors.textSubtle },
  primary: { color: theme.colors.primary },
  inverse: { color: theme.colors.onSurfaceInverse },
  danger: { color: theme.colors.danger },
  success: { color: theme.colors.success },
});
