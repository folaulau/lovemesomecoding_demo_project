import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Button } from './Button';
import { theme } from '@/theme';

/**
 * The three states every data screen has: loading, empty, failed.
 *
 * <p>They live together because they are one decision, not three. A screen that renders a spinner
 * but forgets the error branch shows an eternal spinner when the backend is down — the single most
 * common bug in a fetch-and-render app, and the reason these are components rather than a pattern
 * each screen re-implements.
 */

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.centred}>
      {/* accessibilityLabel matters: a spinner is invisible to a screen reader without one. */}
      <ActivityIndicator size="large" color={theme.colors.primary} accessibilityLabel={label} />
      <Text variant="caption" tone="muted" style={styles.caption}>
        {label}
      </Text>
    </View>
  );
}

export function EmptyState({
  emoji = '🍕',
  title,
  message,
  actionLabel,
  onAction,
}: {
  emoji?: string;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.centred}>
      <Text style={styles.emoji} accessibilityElementsHidden importantForAccessibility="no">
        {emoji}
      </Text>
      <Text variant="subheading" center>
        {title}
      </Text>
      {message ? (
        <Text variant="caption" tone="muted" center style={styles.caption}>
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.errorBox}>
      {/*
       * `accessible` groups the two lines into ONE element, so VoiceOver reads "Something went
       * wrong, could not load the menu" as a single announcement instead of two separate stops.
       *
       * The retry button is deliberately OUTSIDE this View. An `accessible` container hides its
       * children from the accessibility tree on iOS, so a button nested inside would become
       * unreachable — the classic way this pattern goes wrong.
       */}
      <View accessible accessibilityRole="alert">
        <Text variant="bodyStrong" tone="danger">
          Something went wrong
        </Text>
        <Text variant="caption" tone="muted" style={styles.caption}>
          {message}
        </Text>
      </View>

      {onRetry ? (
        <Button
          title="Try again"
          variant="outline"
          size="sm"
          onPress={onRetry}
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centred: { alignItems: 'center', justifyContent: 'center', paddingVertical: theme.spacing.xxxl },
  emoji: { fontSize: 44, marginBottom: theme.spacing.sm },
  caption: { marginTop: theme.spacing.sm },
  action: { marginTop: theme.spacing.lg, alignSelf: 'center' },
  errorBox: {
    backgroundColor: theme.colors.dangerSoft,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.danger,
  },
});
