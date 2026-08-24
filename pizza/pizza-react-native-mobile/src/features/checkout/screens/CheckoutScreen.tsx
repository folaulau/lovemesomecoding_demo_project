import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Screen,
  SegmentedControl,
  Text,
  TextField,
  type Segment,
} from '@/components/ui';
import { orderApi, profileApi, toUserMessage } from '@/api';
import { useCart } from '@/features/cart/state/CartProvider';
import { useAuth } from '@/features/auth/state/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { usePaymentGateway } from '../payment';
import { useCheckoutForm } from '../hooks/useCheckoutForm';
import { OrderSummary } from '../components/OrderSummary';
import { NEW_ADDRESS, SavedAddressPicker } from '../components/SavedAddressPicker';
import { theme } from '@/theme';
import type { Address, OrderCreateRequest, OrderCreateResponse, OrderType } from '@/types';

const ORDER_TYPES: readonly Segment<OrderType>[] = [
  { value: 'DELIVERY', label: 'Delivery', subtitle: '$3.99 fee' },
  { value: 'CARRYOUT', label: 'Pickup', subtitle: 'No fee' },
];

/**
 * Checkout, in two steps.
 *
 * <p>1. Collect contact/address and POST /api/orders. The server prices the cart from the database,
 * saves the order as PENDING_PAYMENT and opens a Stripe PaymentIntent, returning its clientSecret.
 *
 * <p>2. Hand that clientSecret to Stripe's native payment sheet.
 *
 * <p>The order has to exist before the sheet can open, because the PaymentIntent is what the sheet
 * confirms. That ordering is why this is two steps rather than one submit.
 *
 * <p>Note what is NOT sent in step 1: no prices. The server decides what the cart costs, and a
 * patched app sending `total: 0.01` changes nothing.
 */
export function CheckoutScreen() {
  const { items, totals, orderType, setOrderType, clear } = useCart();
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const payment = usePaymentGateway();
  const router = useRouter();

  const form = useCheckoutForm({
    customerName: user?.fullName ?? '',
    email: user?.email ?? '',
  });

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>(NEW_ADDRESS);

  const [submitting, setSubmitting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Set once the order exists server-side; its presence is what advances us to step 2. */
  const [created, setCreated] = useState<OrderCreateResponse | null>(null);

  const isDelivery = orderType === 'DELIVERY';
  const usingNewAddress = selectedAddressId === NEW_ADDRESS;

  /* Load the customer's saved addresses and preselect their PRIMARY one. Guests skip this. */
  useEffect(() => {
    if (!isAuthenticated) return;

    const controller = new AbortController();

    profileApi
      .listAddresses(controller.signal)
      .then((saved) => {
        if (controller.signal.aborted) return;
        setAddresses(saved);

        const primary = saved.find((address) => address.primary) ?? saved[0];
        if (primary) setSelectedAddressId(primary.id);
      })
      .catch(() => {
        // A profile that will not load must not block checkout — fall back to typing an address.
      });

    return () => controller.abort();
  }, [isAuthenticated]);

  /** The address fields to send: from the chosen saved address, or from the form. */
  function addressFields() {
    if (!usingNewAddress) {
      const chosen = addresses.find((address) => address.id === selectedAddressId);
      if (chosen) {
        return {
          addressLine1: chosen.line1,
          addressLine2: chosen.line2 ?? undefined,
          city: chosen.city,
          state: chosen.state,
          postalCode: chosen.postalCode,
        };
      }
    }
    return {
      addressLine1: form.values.addressLine1,
      city: form.values.city,
      state: form.values.state,
      postalCode: form.values.postalCode,
    };
  }

  async function handleCreateOrder() {
    if (!form.validate({ orderType, needsTypedAddress: usingNewAddress })) return;

    setSubmitting(true);
    setError(null);

    const payload: OrderCreateRequest = {
      orderType,
      customerName: form.values.customerName,
      // Ignored by the server when a token is present — the account's email wins.
      guestEmail: form.values.email,
      phone: form.values.phone || undefined,
      ...(isDelivery ? addressFields() : {}),
      items: items.map((item) => ({
        productId: item.productId,
        size: item.size,
        crustId: item.crustId,
        toppingIds: item.toppings.map((topping) => topping.id),
        quantity: item.quantity,
      })),
    };

    try {
      const response = await orderApi.create(payload, isAuthenticated);
      setCreated(response);
    } catch (err) {
      setError(toUserMessage(err, 'Could not create the order.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePay() {
    if (!created?.clientSecret) return;

    setPaying(true);
    setError(null);

    const outcome = await payment.payForOrder({
      clientSecret: created.clientSecret,
      customerName: form.values.customerName,
      customerEmail: form.values.email,
    });

    setPaying(false);

    if (outcome.status === 'cancelled') {
      // Not an error. The order is still reserved and they can try again.
      return;
    }
    if (outcome.status === 'failed') {
      setError(outcome.message);
      return;
    }

    /*
     * Stripe accepted the card. The cart is done; the confirmation screen asks OUR server whether
     * the payment settled, because the device is not the authority on that.
     *
     * `replace`, not `push`: the back gesture must not return to a checkout for an order that has
     * already been paid.
     */
    clear();
    showToast('Payment accepted');
    router.replace(`/order/${created.order.id}`);
  }

  if (items.length === 0 && !created) {
    return (
      <Screen>
        <EmptyState
          title="Your cart is empty"
          message="Add a pizza before checking out."
          actionLabel="Browse the menu"
          onAction={() => router.replace('/menu')}
        />
      </Screen>
    );
  }

  /* ------------------------------------------------------------------ step 2: pay */
  if (created) {
    return (
      <Screen testID="checkout-payment-step">
        <OrderSummary
          items={items}
          orderType={orderType}
          totals={totals}
          order={created.order}
        />

        <Card style={styles.card}>
          <Text variant="label" tone="muted">
            Payment
          </Text>

          {error ? (
            <View style={styles.error}>
              <ErrorState message={error} />
            </View>
          ) : null}

          {created.clientSecret && payment.isReady ? (
            <>
              <Text variant="caption" tone="muted" style={styles.paymentCopy}>
                Card details are collected by Stripe in its own secure sheet — they never reach this
                app. Test mode: use 4242 4242 4242 4242, any future expiry, any CVC.
              </Text>
              <Button
                title="Pay now"
                onPress={handlePay}
                loading={paying}
                fullWidth
                size="lg"
                style={styles.payButton}
                testID="checkout-pay"
              />
            </>
          ) : (
            <Text variant="caption" tone="muted" style={styles.paymentCopy}>
              {created.clientSecret
                ? 'Card payment is only available in the iOS and Android builds.'
                : 'The server created this order but returned no Stripe client secret, which means no Stripe key is configured on the backend. Set pizza.stripe.secret-key in application-local.properties and run with the local profile.'}
            </Text>
          )}

          <Text variant="caption" tone="subtle" style={styles.reserved}>
            Order {created.order.id.slice(0, 8)}… is reserved. It is not paid until the card is
            confirmed.
          </Text>
        </Card>
      </Screen>
    );
  }

  /* ------------------------------------------------------------------ step 1: details */
  return (
    <Screen testID="checkout-screen">
      <Text variant="title">Checkout</Text>

      {error ? (
        <View style={styles.error}>
          <ErrorState message={error} />
        </View>
      ) : null}

      {!isAuthenticated ? (
        <Card style={styles.card}>
          <Text variant="caption" tone="muted">
            Checking out as a guest. Signing in saves this order to your account — entirely
            optional.
          </Text>
        </Card>
      ) : null}

      <Card style={styles.card}>
        <Text variant="label" tone="muted">
          How would you like it?
        </Text>
        <View style={styles.sectionBody}>
          <SegmentedControl
            segments={ORDER_TYPES}
            value={orderType}
            onChange={setOrderType}
            testIDPrefix="checkout-order-type"
          />
        </View>
      </Card>

      <Card style={styles.card}>
        <Text variant="label" tone="muted">
          Contact
        </Text>
        <View style={styles.sectionBody}>
          <TextField
            label="Name"
            required
            value={form.values.customerName}
            onChangeText={(value) => form.setField('customerName', value)}
            error={form.errors.customerName}
            textContentType="name"
            autoComplete="name"
            testID="field-name"
          />
          <TextField
            label="Email"
            required
            value={form.values.email}
            onChangeText={(value) => form.setField('email', value)}
            error={form.errors.email}
            keyboardType="email-address"
            // Without these two the OS capitalises the first letter and the address is rejected.
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            autoComplete="email"
            testID="field-email"
          />
          <TextField
            label="Phone"
            value={form.values.phone}
            onChangeText={(value) => form.setField('phone', value)}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            testID="field-phone"
          />
        </View>
      </Card>

      {/* Address fields only exist for delivery. */}
      {isDelivery ? (
        <Card style={styles.card}>
          <Text variant="label" tone="muted">
            Delivery address
          </Text>
          <View style={styles.sectionBody}>
            <SavedAddressPicker
              addresses={addresses}
              selectedId={selectedAddressId}
              onSelect={setSelectedAddressId}
            />

            {usingNewAddress ? (
              <>
                <TextField
                  label="Street address"
                  required
                  value={form.values.addressLine1}
                  onChangeText={(value) => form.setField('addressLine1', value)}
                  error={form.errors.addressLine1}
                  textContentType="streetAddressLine1"
                  testID="field-address"
                />
                <TextField
                  label="City"
                  required
                  value={form.values.city}
                  onChangeText={(value) => form.setField('city', value)}
                  error={form.errors.city}
                  textContentType="addressCity"
                  testID="field-city"
                />
                <View style={styles.row}>
                  <View style={styles.rowItem}>
                    <TextField
                      label="State"
                      required
                      value={form.values.state}
                      onChangeText={(value) => form.setField('state', value)}
                      error={form.errors.state}
                      autoCapitalize="characters"
                      maxLength={2}
                      textContentType="addressState"
                      testID="field-state"
                    />
                  </View>
                  <View style={styles.rowItem}>
                    <TextField
                      label="ZIP"
                      required
                      value={form.values.postalCode}
                      onChangeText={(value) => form.setField('postalCode', value)}
                      error={form.errors.postalCode}
                      // number-pad, not numeric: no decimal point on a ZIP code.
                      keyboardType="number-pad"
                      maxLength={5}
                      textContentType="postalCode"
                      testID="field-zip"
                    />
                  </View>
                </View>
              </>
            ) : null}
          </View>
        </Card>
      ) : null}

      <View style={styles.card}>
        <OrderSummary items={items} orderType={orderType} totals={totals} />
      </View>

      <Button
        title="Continue to payment"
        onPress={handleCreateOrder}
        loading={submitting}
        fullWidth
        size="lg"
        style={styles.card}
        testID="checkout-continue"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: theme.spacing.lg },
  sectionBody: { marginTop: theme.spacing.md },
  row: { flexDirection: 'row', gap: theme.spacing.md },
  rowItem: { flex: 1 },
  error: { marginTop: theme.spacing.lg },
  paymentCopy: { marginTop: theme.spacing.md },
  payButton: { marginTop: theme.spacing.lg },
  reserved: { marginTop: theme.spacing.md },
});
