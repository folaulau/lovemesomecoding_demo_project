import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StripeProvider } from '@/features/checkout/payment';
import { AuthProvider } from '@/features/auth/state/AuthProvider';
import { MenuProvider } from '@/features/menu/state/MenuProvider';
import { CartProvider } from '@/features/cart/state/CartProvider';
import { ToastProvider } from './ToastProvider';

/**
 * Every provider the app needs, composed in one place.
 *
 * <p>THE ORDER IS LOAD-BEARING, and not arbitrary:
 *
 * <ul>
 *   <li>`SafeAreaProvider` is outermost — `useSafeAreaInsets` is called by the screen shell and by
 *       the toast host, so it has to wrap both.</li>
 *   <li>`MenuProvider` sits ABOVE `CartProvider` because the cart calls `useMenu()` when it
 *       rehydrates a saved basket: a stored line holds only ids, so prices come from the
 *       catalogue. Swap the two and the app crashes with "useMenu must be used inside a
 *       MenuProvider" on the first launch that has a saved cart.</li>
 *   <li>`ToastProvider` is innermost of the state providers so its host renders on top of the
 *       screens, but still inside `SafeAreaProvider`.</li>
 * </ul>
 *
 * <p>Keeping this in one component rather than nesting five providers inside the root layout means
 * the ordering constraint above is documented next to the code that depends on it.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider>
      <StripeProvider>
        <AuthProvider>
          <MenuProvider>
            <CartProvider>
              <ToastProvider>{children}</ToastProvider>
            </CartProvider>
          </MenuProvider>
        </AuthProvider>
      </StripeProvider>
    </SafeAreaProvider>
  );
}
