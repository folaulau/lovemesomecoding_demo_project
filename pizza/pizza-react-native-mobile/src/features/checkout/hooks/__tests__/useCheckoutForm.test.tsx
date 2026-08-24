import { act, renderHook } from '@testing-library/react-native';
import { useCheckoutForm, validateCheckout, type CheckoutFormValues } from '../useCheckoutForm';

function values(overrides: Partial<CheckoutFormValues> = {}): CheckoutFormValues {
  return {
    customerName: 'Folau Kaveinga',
    email: 'folau@example.com',
    phone: '',
    addressLine1: '1 Market St',
    city: 'San Francisco',
    state: 'CA',
    postalCode: '94105',
    ...overrides,
  };
}

const DELIVERY_TYPED = { orderType: 'DELIVERY' as const, needsTypedAddress: true };
const DELIVERY_SAVED = { orderType: 'DELIVERY' as const, needsTypedAddress: false };
const PICKUP = { orderType: 'CARRYOUT' as const, needsTypedAddress: true };

describe('validateCheckout', () => {
  it('accepts a complete delivery order', () => {
    expect(validateCheckout(values(), DELIVERY_TYPED)).toEqual({});
  });

  it('requires a name', () => {
    // Whitespace is not a name.
    expect(validateCheckout(values({ customerName: '   ' }), DELIVERY_TYPED)).toHaveProperty(
      'customerName',
    );
  });

  it.each(['', 'not-an-email', 'missing@domain', 'no-at-sign.com', 'spaces @example.com'])(
    'rejects %p as an email',
    (email) => {
      expect(validateCheckout(values({ email }), DELIVERY_TYPED)).toHaveProperty('email');
    },
  );

  it('accepts an email with a plus tag and a subdomain', () => {
    const errors = validateCheckout(
      values({ email: 'folau+pizza@mail.example.co.uk' }),
      DELIVERY_TYPED,
    );
    expect(errors.email).toBeUndefined();
  });

  it('requires the address fields for delivery', () => {
    const errors = validateCheckout(
      values({ addressLine1: '', city: '', state: '', postalCode: '' }),
      DELIVERY_TYPED,
    );

    expect(errors).toHaveProperty('addressLine1');
    expect(errors).toHaveProperty('city');
    expect(errors).toHaveProperty('state');
    expect(errors).toHaveProperty('postalCode');
  });

  it('skips the address fields for pickup — there is nowhere to deliver to', () => {
    const errors = validateCheckout(
      values({ addressLine1: '', city: '', state: '', postalCode: '' }),
      PICKUP,
    );

    expect(errors).toEqual({});
  });

  it('skips the address fields when a SAVED address is selected', () => {
    const errors = validateCheckout(
      values({ addressLine1: '', city: '', state: '', postalCode: '' }),
      DELIVERY_SAVED,
    );

    expect(errors).toEqual({});
  });

  it.each(['1234', '123456', 'ABCDE', '9410a'])('rejects %p as a ZIP', (postalCode) => {
    expect(validateCheckout(values({ postalCode }), DELIVERY_TYPED)).toHaveProperty('postalCode');
  });
});

/* -------------------------------------------------------------------- the hook itself */

describe('useCheckoutForm', () => {
  it('seeds itself from the signed-in customer, and blanks the rest', async () => {
    const { result } = await renderHook(() =>
      useCheckoutForm({ customerName: 'Folau Kaveinga', email: 'folau@example.com' }),
    );

    expect(result.current.values.customerName).toBe('Folau Kaveinga');
    expect(result.current.values.email).toBe('folau@example.com');
    expect(result.current.values.postalCode).toBe('');
  });

  it('shows no errors before the first submit, even when the form is empty', async () => {
    const { result } = await renderHook(() => useCheckoutForm({}));

    expect(result.current.errors).toEqual({});
  });

  it('surfaces the errors once validate has run', async () => {
    const { result } = await renderHook(() => useCheckoutForm({}));

    let valid = true;
    await act(async () => {
      valid = result.current.validate(DELIVERY_TYPED);
    });

    expect(valid).toBe(false);
    expect(result.current.errors.customerName).toBeDefined();
    expect(result.current.errors.email).toBeDefined();
  });

  it('clears a field error as soon as that field is edited', async () => {
    const { result } = await renderHook(() => useCheckoutForm({}));

    await act(async () => {
      result.current.validate(DELIVERY_TYPED);
    });
    expect(result.current.errors.customerName).toBeDefined();

    await act(async () => {
      result.current.setField('customerName', 'Folau');
    });

    // Nagging while somebody is still typing is hostile — the message goes at the first keystroke.
    expect(result.current.errors.customerName).toBeUndefined();
    // The other fields are untouched, so their errors stay.
    expect(result.current.errors.email).toBeDefined();
  });

  it('returns true once everything is filled in', async () => {
    const { result } = await renderHook(() => useCheckoutForm({}));

    await act(async () => {
      result.current.setField('customerName', 'Folau Kaveinga');
      result.current.setField('email', 'folau@example.com');
      result.current.setField('addressLine1', '1 Market St');
      result.current.setField('city', 'San Francisco');
      result.current.setField('state', 'CA');
      result.current.setField('postalCode', '94105');
    });

    let valid = false;
    await act(async () => {
      valid = result.current.validate(DELIVERY_TYPED);
    });

    expect(valid).toBe(true);
    expect(result.current.errors).toEqual({});
  });
});
