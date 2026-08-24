import { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';
import { Text } from './Text';
import { theme } from '@/theme';

export interface TextFieldProps extends Omit<TextInputProps, 'style' | 'onChangeText' | 'value'> {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  /** Message shown under the field, in red. Usually a server-side field error. */
  error?: string | undefined;
  hint?: string;
  required?: boolean;
  keyboardType?: KeyboardTypeOptions;
}

/**
 * A labelled text input.
 *
 * <p>Two native details worth naming, both invisible on the web:
 *
 * <ul>
 *   <li><b>`keyboardType` and `textContentType` change the keyboard itself.</b> An email field
 *       should show the "@" key; a ZIP field should show digits. The web's `type="email"` did this
 *       implicitly on mobile browsers — here it is explicit, and skipping it is the difference
 *       between a pleasant form and an infuriating one.</li>
 *   <li><b>`autoCapitalize` defaults to sentences.</b> An email field left alone will capitalise
 *       the first letter and then reject the address. This is the single most common React Native
 *       form bug.</li>
 * </ul>
 *
 * <p>The focus ring is drawn by swapping the border colour on focus, because there is no `:focus`
 * pseudo-class to hook — hence the local `focused` state.
 */
export function TextField({
  label,
  value,
  onChangeText,
  error,
  hint,
  required = false,
  ...inputProps
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text variant="caption" tone="muted" style={styles.label}>
        {label}
        {required ? ' *' : ''}
      </Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor={theme.colors.textSubtle}
        accessibilityLabel={label}
        style={[styles.input, focused && styles.inputFocused, Boolean(error) && styles.inputError]}
        {...inputProps}
      />

      {error ? (
        <Text variant="caption" tone="danger" style={styles.message}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="subtle" style={styles.message}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: theme.spacing.md },
  label: { marginBottom: theme.spacing.xs, fontWeight: theme.fontWeight.semibold },
  input: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    /*
     * Android centres text vertically in a TextInput and iOS does not, so a single `padding`
     * produces two different-looking fields. A fixed height plus horizontal padding is the
     * reliable way to make them match.
     */
    height: 46,
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  inputFocused: { borderColor: theme.colors.primary },
  inputError: { borderColor: theme.colors.danger },
  message: { marginTop: theme.spacing.xs },
});
