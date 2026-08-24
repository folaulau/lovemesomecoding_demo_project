import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  Text,
} from '@/components/ui';
import { profileApi, toUserMessage } from '@/api';
import { useAuth } from '@/features/auth/state/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { usePaymentGateway } from '@/features/checkout/payment';
import { useProfileData } from '../hooks/useProfileData';
import { AddressFormSheet } from '../components/AddressFormSheet';
import { theme } from '@/theme';
import type { Address } from '@/types';

/**
 * The signed-in customer's profile: addresses, saved cards, and sign-out.
 *
 * <p>KNOWN GAP, shared with both web frontends: checkout does not yet offer these saved cards. They
 * can be added and managed here; wiring "pay with a saved card" is the natural next step.
 */
export function ProfileScreen() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const payment = usePaymentGateway();
  const router = useRouter();

  const { addresses, paymentMethods, loading, error, reload } = useProfileData();

  const [editing, setEditing] = useState<Address | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [savingCard, setSavingCard] = useState(false);

  /*
   * A monotonic counter used as the address sheet's `key`, so each open mounts a form seeded from
   * the address being edited rather than an effect copying it in afterwards. See AddressFormSheet.
   */
  const [formKey, setFormKey] = useState(0);

  const openAddressForm = useCallback((address: Address | null) => {
    setEditing(address);
    setFormKey((key) => key + 1);
    setSheetOpen(true);
  }, []);

  const handleSaved = useCallback(
    (message: string) => {
      showToast(message);
      void reload();
    },
    [showToast, reload],
  );

  /**
   * A destructive action gets a confirmation.
   *
   * <p>`Alert.alert` is the platform's own dialog — a real UIAlertController on iOS. There is no
   * `window.confirm` in React Native, and this is deliberately not a custom sheet: for
   * "are you sure you want to delete", matching the OS is what makes it read as serious.
   */
  const confirmDelete = useCallback(
    (title: string, message: string, onConfirm: () => Promise<void>) => {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void onConfirm();
          },
        },
      ]);
    },
    [],
  );

  async function handleAddCard() {
    setSavingCard(true);
    try {
      /*
       * A SetupIntent, not a PaymentIntent: this collects a card without charging it. The server
       * opens it; the Stripe sheet collects the details; only the opaque pm_… token comes back to
       * be saved. No card number, CVC or cardholder name ever reaches our code.
       */
      const { clientSecret } = await profileApi.createSetupIntent();
      const outcome = await payment.saveCard(clientSecret);

      if (outcome.status === 'cancelled') return;
      if (outcome.status === 'failed') {
        showToast(outcome.message, 'danger');
        return;
      }

      await profileApi.addPaymentMethod(outcome.paymentMethodId);
      showToast('Card saved');
      void reload();
    } catch (err) {
      showToast(toUserMessage(err, 'Could not save the card.'), 'danger');
    } finally {
      setSavingCard(false);
    }
  }

  async function handleSignOut() {
    await logout();
    showToast('Signed out');
    router.replace('/');
  }

  if (loading) {
    return (
      <Screen>
        <LoadingState label="Loading your profile…" />
      </Screen>
    );
  }

  return (
    <Screen testID="profile-screen">
      <Text variant="title">Profile</Text>
      <Text variant="caption" tone="muted" style={styles.subtitle}>
        {user?.fullName ? `${user.fullName} · ` : ''}
        {user?.email}
      </Text>

      {error ? (
        <View style={styles.section}>
          <ErrorState message={error} onRetry={reload} />
        </View>
      ) : null}

      {/* ------------------------------------------------------------ addresses */}
      <Card style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text variant="label" tone="muted">
            Delivery addresses
          </Text>
          <Button
            title="Add"
            size="sm"
            variant="outline"
            onPress={() => openAddressForm(null)}
            testID="profile-add-address"
          />
        </View>

        {addresses.length === 0 ? (
          <EmptyState emoji="📍" title="No saved addresses" message="Add one to speed up checkout." />
        ) : (
          addresses.map((address, index) => (
            <View key={address.id}>
              {index > 0 ? <Divider /> : null}
              <View style={styles.row} testID={`profile-address-${address.id}`}>
                <View style={styles.rowBody}>
                  <View style={styles.titleRow}>
                    <Text variant="bodyStrong">{address.label || 'Address'}</Text>
                    {address.primary ? <Badge label="primary" tone="success" /> : null}
                  </View>
                  <Text variant="caption" tone="muted">
                    {address.line1}
                    {address.line2 ? `, ${address.line2}` : ''}
                    {`\n${address.city}, ${address.state} ${address.postalCode}`}
                  </Text>
                </View>

                <View style={styles.actions}>
                  {!address.primary ? (
                    <LinkButton
                      label="Make primary"
                      onPress={async () => {
                        await profileApi.makeAddressPrimary(address.id);
                        handleSaved('Primary address updated');
                      }}
                    />
                  ) : null}
                  <LinkButton label="Edit" onPress={() => openAddressForm(address)} />
                  <LinkButton
                    label="Delete"
                    tone="danger"
                    onPress={async () =>
                      confirmDelete(
                        'Delete this address?',
                        `${address.line1}, ${address.city}`,
                        async () => {
                          await profileApi.deleteAddress(address.id);
                          handleSaved('Address deleted');
                        },
                      )
                    }
                  />
                </View>
              </View>
            </View>
          ))
        )}
      </Card>

      {/* ------------------------------------------------------------ saved cards */}
      <Card style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text variant="label" tone="muted">
            Saved cards
          </Text>
          <Button
            title="Add card"
            size="sm"
            variant="outline"
            onPress={handleAddCard}
            loading={savingCard}
            disabled={!payment.isReady}
            testID="profile-add-card"
          />
        </View>

        {!payment.isReady ? (
          <Text variant="caption" tone="muted">
            Card management is only available in the iOS and Android builds.
          </Text>
        ) : null}

        {paymentMethods.length === 0 ? (
          <EmptyState
            emoji="💳"
            title="No saved cards"
            message="Only the brand, last four digits and expiry are ever stored here — never the number."
          />
        ) : (
          paymentMethods.map((method, index) => (
            <View key={method.id}>
              {index > 0 ? <Divider /> : null}
              <View style={styles.row} testID={`profile-card-${method.id}`}>
                <View style={styles.rowBody}>
                  <View style={styles.titleRow}>
                    <Text variant="bodyStrong">
                      {method.brand ?? 'Card'} •••• {method.last4 ?? '????'}
                    </Text>
                    {method.primary ? <Badge label="primary" tone="success" /> : null}
                  </View>
                  <Text variant="caption" tone="muted">
                    {method.expMonth && method.expYear
                      ? `Expires ${String(method.expMonth).padStart(2, '0')}/${method.expYear}`
                      : 'Expiry unknown'}
                  </Text>
                </View>

                <View style={styles.actions}>
                  {!method.primary ? (
                    <LinkButton
                      label="Make primary"
                      onPress={async () => {
                        await profileApi.makePaymentMethodPrimary(method.id);
                        handleSaved('Primary card updated');
                      }}
                    />
                  ) : null}
                  <LinkButton
                    label="Delete"
                    tone="danger"
                    onPress={async () =>
                      confirmDelete(
                        'Delete this card?',
                        `${method.brand ?? 'Card'} ending ${method.last4 ?? '????'}`,
                        async () => {
                          await profileApi.deletePaymentMethod(method.id);
                          handleSaved('Card deleted');
                        },
                      )
                    }
                  />
                </View>
              </View>
            </View>
          ))
        )}
      </Card>

      <Button
        title="Sign out"
        variant="outline"
        onPress={handleSignOut}
        fullWidth
        style={styles.section}
        testID="profile-sign-out"
      />

      <AddressFormSheet
        key={formKey}
        visible={sheetOpen}
        address={editing}
        onClose={() => setSheetOpen(false)}
        onSaved={handleSaved}
      />
    </Screen>
  );
}

/** A text-only action. The row already carries enough visual weight without three more buttons. */
function LinkButton({
  label,
  onPress,
  tone = 'primary',
}: {
  label: string;
  onPress: () => Promise<void> | void;
  tone?: 'primary' | 'danger';
}) {
  return (
    <Pressable
      onPress={() => void onPress()}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text variant="caption" tone={tone} style={styles.link}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: theme.spacing.xs },
  section: { marginTop: theme.spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  row: { paddingVertical: theme.spacing.sm },
  rowBody: { gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    marginTop: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  link: { fontWeight: theme.fontWeight.semibold },
});
