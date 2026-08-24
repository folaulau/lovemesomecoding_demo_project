import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/theme';

/**
 * The page shell every screen sits in.
 *
 * <p>SAFE AREA is the thing with no web equivalent. A phone screen is not a rectangle you own: a
 * notch, a camera cut-out, the home indicator and the rounded corners all eat into it. Content
 * placed at y=0 is drawn UNDER the notch. `useSafeAreaInsets` reports how much to keep clear on
 * each edge, and it differs per device and per orientation, so it cannot be a constant.
 *
 * <p>The top inset is usually handled by the navigation header, which is why only the bottom is
 * applied by default — a "Pay" button flush against the bottom edge would sit under the home
 * indicator and be genuinely hard to press.
 */
export function Screen({
  children,
  scroll = true,
  padded = true,
  /** Extra bottom room for a screen with its own floating footer bar. */
  bottomInset = 0,
  contentStyle,
  testID,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  bottomInset?: number;
  contentStyle?: ViewStyle;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  const paddingBottom = insets.bottom + theme.spacing.lg + bottomInset;

  if (!scroll) {
    return (
      <View testID={testID} style={[styles.screen, padded && styles.padded, { paddingBottom }, contentStyle]}>
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      testID={testID}
      style={styles.screen}
      contentContainerStyle={[padded && styles.padded, { paddingBottom }, contentStyle]}
      /*
       * Tapping the background should dismiss the keyboard, and a tap on a BUTTON while the
       * keyboard is open should still hit the button. `handled` gives both; the default ('never')
       * swallows that first tap, which is the classic "I have to tap twice" complaint.
       */
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  padded: { padding: theme.spacing.lg },
});
