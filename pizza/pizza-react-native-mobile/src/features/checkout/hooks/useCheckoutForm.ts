import { useCallback, useMemo, useState } from 'react';
import type { OrderType } from '@/types';

/**
 * Checkout's form state and its validation rules, extracted from the screen.
 *
 * <p>The screen was doing three jobs — collecting input, validating it, and orchestrating the
 * two-step order/pay flow. Pulling the first two out here leaves the screen readable, and it makes
 * the rules testable without rendering anything.
 *
 * <p>There is no form library. `useState` over one object plus a validate function is enough for
 * seven fields, and it keeps the example free of an API nobody has to learn to follow it.
 */

export interface CheckoutFormValues {
  customerName: string;
  email: string;
  phone: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
}

export type CheckoutFieldErrors = Partial<Record<keyof CheckoutFormValues, string>>;

/**
 * Deliberately permissive: an address is validated by the delivery driver, not a regex. The rule
 * only has to be strict enough to catch a typo, and loose enough never to reject a real address —
 * over-validating an email is a classic way to lose a customer.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZIP_PATTERN = /^\d{5}$/;

export function validateCheckout(
  values: CheckoutFormValues,
  options: { orderType: OrderType; needsTypedAddress: boolean },
): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {};

  if (!values.customerName.trim()) {
    errors.customerName = 'Please tell us who the order is for.';
  }
  if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = 'We need a valid email to send the receipt.';
  }

  // Address fields only exist for delivery, and only when no saved address is selected.
  if (options.orderType === 'DELIVERY' && options.needsTypedAddress) {
    if (!values.addressLine1.trim()) {
      errors.addressLine1 = 'We cannot deliver without a street address.';
    }
    if (!values.city.trim()) errors.city = 'City is required.';
    if (!values.state.trim()) errors.state = 'State is required.';
    if (!ZIP_PATTERN.test(values.postalCode.trim())) errors.postalCode = 'Five digits, please.';
  }

  return errors;
}

export function useCheckoutForm(initial: Partial<CheckoutFormValues>) {
  const [values, setValues] = useState<CheckoutFormValues>({
    customerName: initial.customerName ?? '',
    email: initial.email ?? '',
    phone: initial.phone ?? '',
    addressLine1: '',
    city: '',
    state: '',
    postalCode: '',
  });

  const [errors, setErrors] = useState<CheckoutFieldErrors>({});
  /** Errors stay hidden until the first submit, so the form does not shout at a blank field. */
  const [submitted, setSubmitted] = useState(false);

  const setField = useCallback((field: keyof CheckoutFormValues, value: string) => {
    // A functional update: safe even when several updates are batched together.
    setValues((current) => ({ ...current, [field]: value }));
    // Clear this field's error as soon as it is edited — nagging while typing is hostile.
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }, []);

  const validate = useCallback(
    (options: { orderType: OrderType; needsTypedAddress: boolean }) => {
      const found = validateCheckout(values, options);
      setErrors(found);
      setSubmitted(true);
      return Object.keys(found).length === 0;
    },
    [values],
  );

  /** Only surface errors once a submit has been attempted. */
  const visibleErrors = useMemo<CheckoutFieldErrors>(
    () => (submitted ? errors : {}),
    [submitted, errors],
  );

  return { values, setField, validate, errors: visibleErrors };
}
