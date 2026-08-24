/**
 * Jest setup, run once before every test file.
 *
 * <p>Native modules are the thing that has to be dealt with here. `expo-secure-store` talks to the
 * iOS Keychain and `@stripe/stripe-react-native` to Stripe's native SDK; neither exists in Node, so
 * a test that touches them throws at import. Mocking them centrally means no individual test has to
 * know that, and the mocks below are shared behaviour rather than copies in twenty files.
 */

/* eslint-disable @typescript-eslint/no-require-imports */

// AsyncStorage ships its own in-memory mock — no need to hand-roll one.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/** The keychain, as a Map. Enough to prove that a token written is a token read back. */
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    __store: store,
  };
});

/**
 * A COUNTER, not a random value.
 *
 * A test asserting "these two cart lines are different" needs ids that differ; a test asserting a
 * snapshot needs them to be reproducible. A counter gives both, which `Math.random()` would not.
 */
jest.mock('expo-crypto', () => {
  let counter = 0;
  return {
    randomUUID: jest.fn(() => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`),
  };
});

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      hostUri: 'localhost:8081',
      extra: {
        apiBaseUrl: 'http://localhost:8085',
        stripePublishableKey: 'pk_test_fixture',
      },
    },
  },
}));

// The native Stripe SDK. Only the surface paymentGateway.tsx touches needs to exist.
jest.mock('@stripe/stripe-react-native', () => ({
  StripeProvider: ({ children }: { children: unknown }) => children,
  useStripe: () => ({
    initPaymentSheet: jest.fn(async () => ({})),
    presentPaymentSheet: jest.fn(async () => ({})),
    retrieveSetupIntent: jest.fn(async () => ({ setupIntent: { paymentMethodId: 'pm_test' } })),
  }),
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(async () => {}),
  hideAsync: jest.fn(async () => {}),
}));
