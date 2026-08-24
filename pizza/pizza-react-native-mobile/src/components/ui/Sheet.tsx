import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { theme } from '@/theme';

/**
 * A bottom sheet — the native shape of react-bootstrap's `<Modal>` and `<Offcanvas>`.
 *
 * <p>Built on React Native's own `<Modal>`, which is a genuinely native window rather than a
 * repositioned `<View>`. That is what makes it sit above everything without a z-index war, and it
 * is the reason there is no equivalent of the web app's `createPortal` anywhere in this codebase:
 * `Modal` already renders outside the parent view hierarchy.
 *
 * <p>Three things Bootstrap gave for free and are hand-wired here:
 *
 * <ul>
 *   <li><b>Android's back button</b> — `onRequestClose`. Without it, back exits the whole app
 *       while a sheet is open. It is required on Android and ignored on iOS.</li>
 *   <li><b>Tap-the-backdrop-to-close</b> — a `Pressable` behind the panel. The panel itself is NOT
 *       inside it, or every tap on the content would close the sheet.</li>
 *   <li><b>The keyboard</b> — `KeyboardAvoidingView`, with different behaviour per platform. iOS
 *       needs `padding`; Android resizes the window itself and `height` is the behaviour that
 *       cooperates with that.</li>
 * </ul>
 *
 * <p>KNOWN GAP, same as the Angular app's drawer: focus is not trapped inside the panel.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />

        <View
          style={[styles.panel, { paddingBottom: insets.bottom + theme.spacing.md }]}
          testID={testID}
        >
          <View style={styles.grabber} />

          <View style={styles.header}>
            <Text variant="heading">{title}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
              testID="sheet-close"
            >
              <Text variant="heading" tone="muted">
                ✕
              </Text>
            </Pressable>
          </View>

          {children}

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  /*
   * `position: 'absolute'` plus four zeroed edges — what `StyleSheet.absoluteFillObject`
   * used to spell. It was removed in React Native 0.86; `absoluteFill` still exists but is a
   * registered style ID, so it cannot be spread into an object literal.
   */
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(35, 31, 32, 0.5)',
  },
  panel: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    // Never taller than 90% of the screen, so the backdrop stays tappable.
    maxHeight: '90%',
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginBottom: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
});
