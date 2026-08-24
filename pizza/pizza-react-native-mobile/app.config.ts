import type { ExpoConfig } from 'expo/config';

/**
 * Expo app configuration, as TypeScript rather than app.json.
 *
 * <p>A static app.json cannot read an environment variable, and two of the values below have to
 * come from the environment: the Stripe publishable key, and the API host that a physical device
 * needs (a device cannot reach "localhost" — that is the phone itself). Exporting a function makes
 * the config a build-time program, so those values can be resolved once, here, instead of being
 * scattered through the app.
 *
 * <p>Everything in `extra` is baked into the JavaScript bundle and is readable by anyone who
 * downloads the app. Only PUBLIC values belong there — the Stripe publishable key qualifies by
 * design; the secret key never leaves the backend.
 */

/** Brand colours, duplicated from src/theme/tokens.ts because native config cannot import TS at this point. */
const PIZZA_RED = '#d8102a';
const PIZZA_CREAM = '#fff8f0';

const config: ExpoConfig = {
  name: 'StayHub Pizza',
  slug: 'pizza-react-native-mobile',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'pizzaapp',
  userInterfaceStyle: 'light',

  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.lovemesomecoding.pizza',
    infoPlist: {
      /*
       * App Transport Security blocks plain HTTP by default, and the development backend is
       * http://localhost:8085. `NSAllowsLocalNetworking` opens LOCAL addresses only — a targeted
       * hole rather than `NSAllowsArbitraryLoads`, which would disable HTTPS enforcement for the
       * entire app. Production talks to an https:// API and needs neither.
       */
      NSAppTransportSecurity: {
        NSAllowsLocalNetworking: true,
      },
    },
  },

  android: {
    package: 'com.lovemesomecoding.pizza',
    adaptiveIcon: {
      backgroundColor: PIZZA_RED,
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },

  web: {
    favicon: './assets/favicon.png',
    /*
     * react-native-web, used only to preview screens in a browser during development and to run
     * the Playwright smoke suite. The shipped product is the native build; the Stripe payment
     * sheet in particular has no web implementation (see src/features/checkout/payment/).
     */
    bundler: 'metro',
    output: 'single',
  },

  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-font',
    'expo-web-browser',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: PIZZA_CREAM,
      },
    ],
    [
      '@stripe/stripe-react-native',
      {
        /*
         * Required by the plugin even when Apple Pay is switched off. `enableGooglePay: false`
         * keeps the Android manifest free of the Google Pay metadata for the same reason —
         * the demo only ever takes a plain card.
         */
        merchantIdentifier: 'merchant.com.lovemesomecoding.pizza',
        enableGooglePay: false,
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
  },

  extra: {
    /**
     * Where the Spring Boot API lives.
     *
     * Left undefined for the simulator/emulator, which resolve it themselves — see
     * src/api/config.ts. Set PIZZA_API_URL to your machine's LAN address to run on a real phone.
     */
    apiBaseUrl: process.env.PIZZA_API_URL,
    stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  },
};

export default config;
