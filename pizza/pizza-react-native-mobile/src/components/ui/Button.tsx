import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { theme } from '@/theme';

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  /** Small second line, e.g. the "$3.99 fee" under "Delivery". */
  subtitle?: string;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
  /** For a toggle-style button, so a screen reader announces it as selected. */
  selected?: boolean;
}

/**
 * The app's button.
 *
 * <p>Built on `Pressable`, not `TouchableOpacity`. Pressable's `style` prop can be a FUNCTION
 * receiving `{ pressed }`, which is how the pressed state is expressed without any animation code
 * — the native answer to CSS `:hover`/`:active`, which do not exist here.
 *
 * <p>ACCESSIBILITY. `accessibilityRole="button"` is what makes VoiceOver say "button" rather than
 * reading the label as plain text, and `accessibilityState` is what makes a disabled or selected
 * button announce as such. On the web Bootstrap's `<button>` gave all of this for free; a `View`
 * gives none of it, so it has to be declared.
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  subtitle,
  style,
  testID,
  accessibilityLabel,
  selected,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled, selected }}
      /*
       * Expands the touch target without changing the layout. Apple asks for 44dp and Android for
       * 48dp; a small chip is often visually smaller than both, and this is the only way to honour
       * that without padding the design out of shape.
       */
      hitSlop={8}
      style={({ pressed }) => [
        styles.base,
        sizeStyles[size],
        variantStyles[variant],
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && pressedStyles[variant],
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={
            variant === 'primary' || variant === 'danger'
              ? theme.colors.onPrimary
              : theme.colors.primary
          }
        />
      ) : (
        <View style={styles.labelStack}>
          <Text variant={size === 'sm' ? 'caption' : 'bodyStrong'} style={labelStyles[variant]}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="caption" style={[styles.subtitle, labelStyles[variant]]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { opacity: 0.45 },
  labelStack: { alignItems: 'center' },
  subtitle: { fontWeight: theme.fontWeight.regular, opacity: 0.85, marginTop: 1 },
});

const sizeStyles = StyleSheet.create({
  sm: { paddingVertical: theme.spacing.xs + 2, paddingHorizontal: theme.spacing.md },
  md: { paddingVertical: theme.spacing.md - 2, paddingHorizontal: theme.spacing.lg },
  lg: { paddingVertical: theme.spacing.lg - 2, paddingHorizontal: theme.spacing.xl },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  outline: { backgroundColor: 'transparent', borderColor: theme.colors.primary },
  ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  danger: { backgroundColor: theme.colors.danger, borderColor: theme.colors.danger },
});

const pressedStyles = StyleSheet.create({
  primary: { backgroundColor: theme.colors.primaryDark, borderColor: theme.colors.primaryDark },
  outline: { backgroundColor: theme.colors.primarySoft },
  ghost: { backgroundColor: theme.colors.surfaceAlt },
  danger: { backgroundColor: theme.colors.primaryDark, borderColor: theme.colors.primaryDark },
});

const labelStyles = StyleSheet.create({
  primary: { color: theme.colors.onPrimary },
  outline: { color: theme.colors.primary },
  ghost: { color: theme.colors.primary },
  danger: { color: theme.colors.onPrimary },
});
