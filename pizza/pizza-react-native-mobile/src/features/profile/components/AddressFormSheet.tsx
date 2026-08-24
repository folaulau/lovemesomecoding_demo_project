import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Sheet, Text, TextField } from '@/components/ui';
import { ApiError, profileApi, toUserMessage } from '@/api';
import { theme } from '@/theme';
import type { Address, AddressWriteRequest } from '@/types';

const EMPTY: AddressWriteRequest = {
  label: '',
  line1: '',
  city: '',
  state: '',
  postalCode: '',
};

/**
 * Add or edit one address.
 *
 * <p>The same sheet does both, keyed off whether an `address` was passed. Two nearly-identical
 * components would drift the moment a field is added to one and not the other.
 */
export function AddressFormSheet({
  visible,
  address,
  onClose,
  onSaved,
}: {
  visible: boolean;
  /** null means "new address". */
  address: Address | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  /*
   * The form is seeded from props ONCE, by a lazy `useState` initialiser, and the profile screen
   * remounts this component (via a `key` it bumps on open) whenever the sheet is opened again.
   *
   * The alternative — an effect that copies `address` into state whenever `visible` flips — renders
   * the previous address for one frame first, and is the cascading update
   * `react-hooks/set-state-in-effect` rejects. Remounting is React's own recommendation for
   * "reset all state when X changes", and it is simpler to read besides.
   */
  const [form, setForm] = useState<AddressWriteRequest>(() => toFormValues(address));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function setField(field: keyof AddressWriteRequest, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      if (address) {
        await profileApi.updateAddress(address.id, form);
        onSaved('Address updated');
      } else {
        await profileApi.addAddress(form);
        onSaved('Address added');
      }
      onClose();
    } catch (err) {
      setError(toUserMessage(err, 'Could not save the address.'));
      // The API returns per-field messages; showing them under the right input beats one banner.
      if (err instanceof ApiError) setFieldErrors(err.fieldErrors());
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={address ? 'Edit address' : 'Add an address'}
      testID="address-form-sheet"
      footer={
        <View style={styles.footer}>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Button
            title={address ? 'Save changes' : 'Add address'}
            onPress={handleSave}
            loading={saving}
            testID="address-save"
          />
        </View>
      }
    >
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {error ? (
          <Text variant="caption" tone="danger" style={styles.error}>
            {error}
          </Text>
        ) : null}

        <TextField
          label="Label"
          hint="Home, Work — whatever helps you pick it at checkout."
          value={form.label ?? ''}
          onChangeText={(value) => setField('label', value)}
          error={fieldErrors['label']}
          testID="address-label"
        />
        <TextField
          label="Street address"
          required
          value={form.line1}
          onChangeText={(value) => setField('line1', value)}
          error={fieldErrors['line1']}
          textContentType="streetAddressLine1"
          testID="address-line1"
        />
        <TextField
          label="Apartment, suite"
          value={form.line2 ?? ''}
          onChangeText={(value) => setField('line2', value)}
          error={fieldErrors['line2']}
          textContentType="streetAddressLine2"
        />
        <TextField
          label="City"
          required
          value={form.city}
          onChangeText={(value) => setField('city', value)}
          error={fieldErrors['city']}
          textContentType="addressCity"
          testID="address-city"
        />

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <TextField
              label="State"
              required
              value={form.state}
              onChangeText={(value) => setField('state', value)}
              error={fieldErrors['state']}
              autoCapitalize="characters"
              maxLength={2}
              textContentType="addressState"
              testID="address-state"
            />
          </View>
          <View style={styles.rowItem}>
            <TextField
              label="ZIP"
              required
              value={form.postalCode}
              onChangeText={(value) => setField('postalCode', value)}
              error={fieldErrors['postalCode']}
              keyboardType="number-pad"
              maxLength={5}
              textContentType="postalCode"
              testID="address-zip"
            />
          </View>
        </View>
      </ScrollView>
    </Sheet>
  );
}

/** An `Address` from the API, flattened into the shape the form edits. */
function toFormValues(address: Address | null): AddressWriteRequest {
  if (!address) return EMPTY;
  return {
    label: address.label ?? '',
    line1: address.line1,
    line2: address.line2 ?? '',
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
  };
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing.sm },
  row: { flexDirection: 'row', gap: theme.spacing.md },
  rowItem: { flex: 1 },
  error: { marginBottom: theme.spacing.md },
});
