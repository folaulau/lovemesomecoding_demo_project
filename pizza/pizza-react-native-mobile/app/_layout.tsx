import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppProviders } from '@/providers/AppProviders';
import { useAuth } from '@/features/auth/state/AuthProvider';
import { theme } from '@/theme';

export { ErrorBoundary } from '@/components/RouteErrorBoundary';

/*
 * Hold the splash screen until the app knows whether anyone is signed in.
 *
 * Called at MODULE level, before React renders anything — by the time a component mounts it is
 * already too late to prevent the first frame. Without this the app flashes a signed-out home
 * screen and then swaps, because reading the keychain is asynchronous.
 */
void SplashScreen.preventAutoHideAsync();

/**
 * The root layout. Every route in the app renders inside this.
 *
 * <p>EXPO ROUTER CONCEPT: file-based routing. The folder structure under `app/` IS the navigation
 * graph — `app/(tabs)/menu.tsx` is `/menu`, and `app/order/[orderId].tsx` is `/order/:orderId`.
 * There is no route table to keep in sync with the files, which is the main thing it buys over
 * declaring a `<Stack.Navigator>` by hand.
 *
 * <p>Parentheses make a GROUP: `(tabs)` organises files without adding a `/tabs` segment to the URL.
 */
export default function RootLayout() {
  return (
    /*
     * GestureHandlerRootView must be the outermost view, and it must fill the screen. Swipe-back
     * and every gesture-driven component inside depend on it; a missing one fails silently — the
     * gestures simply never fire, with no warning to explain why.
     */
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProviders>
        <StatusBar style="light" />
        <RootNavigator />
      </AppProviders>
    </GestureHandlerRootView>
  );
}

/**
 * Split from RootLayout because it calls `useAuth`, and a hook can only read a context its own
 * component is rendered INSIDE. RootLayout renders the provider, so it cannot also consume it.
 */
function RootNavigator() {
  const { initialising } = useAuth();

  useEffect(() => {
    if (!initialising) void SplashScreen.hideAsync();
  }, [initialising]);

  // Keep the splash up rather than flashing an empty screen behind it.
  if (initialising) return null;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surfaceInverse },
        headerTintColor: theme.colors.onSurfaceInverse,
        headerTitleStyle: { fontWeight: theme.fontWeight.bold },
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      {/* The tab bar draws its own headers, so the stack must not draw a second one above it. */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="checkout" options={{ title: 'Checkout' }} />
      <Stack.Screen name="order/[orderId]" options={{ title: 'Your order' }} />
      {/*
        `presentation: 'modal'` gives the iOS card-over-the-app transition, which is the platform's
        way of saying "this is a detour, swipe down to leave". Auth is exactly that here: ordering
        never requires it.
      */}
      <Stack.Screen name="login" options={{ title: 'Sign in', presentation: 'modal' }} />
      <Stack.Screen name="register" options={{ title: 'Create account', presentation: 'modal' }} />
    </Stack>
  );
}
