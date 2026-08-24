import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, ErrorState, Screen, Text, TextField } from '@/components/ui';
import { useAuth } from '../state/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { theme } from '@/theme';

export function LoginScreen() {
  const { login, loading, error, fieldErrors } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit() {
    try {
      await login(email.trim(), password);
      showToast('Signed in');
      /*
       * `back()` rather than a fixed destination. Sign-in is reached from several places — the
       * profile tab, and eventually from checkout — and hard-coding a route would strand the
       * customer somewhere they did not come from.
       */
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch {
      // The provider already put the message in `error`; nothing to do but stay on the screen.
    }
  }

  return (
    <Screen testID="login-screen">
      <Text variant="title">Sign in</Text>
      <Text variant="caption" tone="muted" style={styles.subtitle}>
        Ordering never requires an account — signing in just saves your orders, addresses and cards.
      </Text>

      {error ? (
        <View style={styles.error}>
          <ErrorState message={error} />
        </View>
      ) : null}

      <Card style={styles.card}>
        <TextField
          label="Email"
          required
          value={email}
          onChangeText={setEmail}
          error={fieldErrors['email']}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
          autoComplete="email"
          testID="login-email"
        />
        <TextField
          label="Password"
          required
          value={password}
          onChangeText={setPassword}
          error={fieldErrors['password']}
          secureTextEntry
          /*
           * `textContentType="password"` is what offers the iOS keychain autofill bar. Without it
           * a saved password is invisible to the customer and they retype it every time.
           */
          textContentType="password"
          autoComplete="current-password"
          // Submitting from the keyboard is expected on a phone; there is no Enter key otherwise.
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
          testID="login-password"
        />

        <Button
          title="Sign in"
          onPress={handleSubmit}
          loading={loading}
          fullWidth
          size="lg"
          style={styles.submit}
          testID="login-submit"
        />
      </Card>

      <Button
        title="Create an account"
        variant="ghost"
        onPress={() => router.push('/register')}
        fullWidth
        style={styles.secondary}
      />

      <Card style={styles.demo}>
        <Text variant="label" tone="muted">
          Demo logins
        </Text>
        <Text variant="caption" tone="muted" style={styles.demoLine}>
          customer@pizza.test · pizza123
        </Text>
        <Text variant="caption" tone="muted">
          admin@pizza.test · admin123 (admin screens are web-only)
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: theme.spacing.xs },
  error: { marginTop: theme.spacing.lg },
  card: { marginTop: theme.spacing.lg },
  submit: { marginTop: theme.spacing.sm },
  secondary: { marginTop: theme.spacing.md },
  demo: { marginTop: theme.spacing.xl, backgroundColor: theme.colors.surfaceAlt },
  demoLine: { marginTop: theme.spacing.xs },
});
