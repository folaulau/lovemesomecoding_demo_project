import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, ErrorState, Screen, Text, TextField } from '@/components/ui';
import { useAuth } from '../state/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { theme } from '@/theme';

export function RegisterScreen() {
  const { register, loading, error, fieldErrors } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit() {
    try {
      await register(email.trim(), password, fullName.trim());
      showToast('Welcome to StayHub Pizza');
      router.replace('/');
    } catch {
      // Handled by the provider — the message is already in `error`.
    }
  }

  return (
    <Screen testID="register-screen">
      <Text variant="title">Create an account</Text>
      <Text variant="caption" tone="muted" style={styles.subtitle}>
        {/*
          Worth stating plainly, because the API enforces it: registration ALWAYS creates a
          customer. There is no role field to send, and adding one would achieve nothing.
        */}
        New accounts are always customers.
      </Text>

      {error ? (
        <View style={styles.error}>
          <ErrorState message={error} />
        </View>
      ) : null}

      <Card style={styles.card}>
        <TextField
          label="Full name"
          required
          value={fullName}
          onChangeText={setFullName}
          error={fieldErrors['fullName']}
          autoCapitalize="words"
          textContentType="name"
          autoComplete="name"
          testID="register-name"
        />
        <TextField
          label="Email"
          required
          value={email}
          onChangeText={setEmail}
          error={fieldErrors['email']}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
          autoComplete="email"
          testID="register-email"
        />
        <TextField
          label="Password"
          required
          value={password}
          onChangeText={setPassword}
          error={fieldErrors['password']}
          hint="At least 8 characters."
          secureTextEntry
          /*
           * `newPassword`, not `password` — it is what makes iOS offer to GENERATE and save a
           * strong one rather than autofilling an existing credential.
           */
          textContentType="newPassword"
          autoComplete="new-password"
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
          testID="register-password"
        />

        <Button
          title="Create account"
          onPress={handleSubmit}
          loading={loading}
          fullWidth
          size="lg"
          style={styles.submit}
          testID="register-submit"
        />
      </Card>

      <Button
        title="I already have an account"
        variant="ghost"
        onPress={() => router.replace('/login')}
        fullWidth
        style={styles.secondary}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: theme.spacing.xs },
  error: { marginTop: theme.spacing.lg },
  card: { marginTop: theme.spacing.lg },
  submit: { marginTop: theme.spacing.sm },
  secondary: { marginTop: theme.spacing.md },
});
