import { StyleSheet, View } from 'react-native';
import { Button, Card, Screen, Text } from '@/components/ui';
import { theme } from '@/theme';

/**
 * What a route shows when its render throws.
 *
 * <p>Expo Router looks for an exported `ErrorBoundary` in a layout file and wraps that layout's
 * screens in it. Exporting this one from `app/_layout.tsx` means a crash in any screen shows this
 * instead of a red box in development or a blank white app in production.
 *
 * <p>It is a plain component, not a class, because Expo Router supplies the caught error and the
 * retry function as props — the `componentDidCatch` machinery lives in the router.
 *
 * <p>NOTE what an error boundary does NOT catch: errors thrown in an event handler, in a
 * `setTimeout`, or in an async function. Those are not part of rendering. That is why every API
 * call in this app has its own try/catch and its own error state.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <Screen>
      <View style={styles.wrapper}>
        <Text style={styles.emoji} accessibilityElementsHidden importantForAccessibility="no">
          🍕
        </Text>
        <Text variant="title" center>
          That did not go to plan
        </Text>
        <Text variant="caption" tone="muted" center style={styles.copy}>
          This screen hit an error it could not recover from on its own.
        </Text>

        <Card style={styles.detail}>
          <Text variant="mono" tone="muted">
            {error.message}
          </Text>
        </Card>

        <Button title="Try again" onPress={() => void retry()} fullWidth style={styles.action} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingTop: theme.spacing.xxxl, alignItems: 'center' },
  emoji: { fontSize: 52, marginBottom: theme.spacing.md },
  copy: { marginTop: theme.spacing.sm },
  detail: { marginTop: theme.spacing.xl, alignSelf: 'stretch', backgroundColor: theme.colors.surfaceAlt },
  action: { marginTop: theme.spacing.xl },
});
