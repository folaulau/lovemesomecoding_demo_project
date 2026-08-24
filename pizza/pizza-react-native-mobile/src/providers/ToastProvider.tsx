import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui';
import { newId } from '@/domain/ids';
import { theme } from '@/theme';

/* ==========================================================================
 * RN CONCEPT: no portal needed
 *
 * The web version of this file is built on createPortal, because a toast fired from inside a modal
 * would otherwise be clipped by an ancestor's `overflow: hidden` or buried under a stacking
 * context. React Native has neither: `overflow` does not clip absolutely-positioned siblings the
 * same way, and `zIndex` is scoped to a parent that actually establishes ordering.
 *
 * So the host simply sits last in the provider's tree with `position: absolute`. Rendering order
 * decides what is on top, and being last means on top.
 * ========================================================================== */

type ToastVariant = 'success' | 'danger' | 'info';

interface ToastMessage {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const VISIBLE_MS = 3000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  /*
   * Timers are tracked in a ref so they can be cleared. A `setTimeout` that fires after the app is
   * backgrounded still runs when it returns, and without this the queue would drain in a burst.
   */
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'success') => {
      const id = newId();
      setToasts((current) => [...current, { id, message, variant }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), VISIBLE_MS),
      );
    },
    [dismiss],
  );

  /*
   * Clear every pending timer when the provider unmounts.
   *
   * Without this, a toast shown just before navigating away leaves a `setTimeout` holding a
   * reference to a setState on an unmounted tree. Jest catches it as "Jest did not exit one second
   * after the test run has completed", which is exactly the signal it is meant to be — on a device
   * it is a small leak that a busy screen repeats hundreds of times.
   *
   * The empty dependency array is deliberate: this must run on unmount and never in between.
   */
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastHost toasts={toasts} />
    </ToastContext.Provider>
  );
}

/** The stack itself. Pointer events pass through the container so it never blocks a tap. */
function ToastHost({ toasts }: { toasts: ToastMessage[] }) {
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <View style={[styles.host, { top: insets.top + theme.spacing.sm }]} pointerEvents="none">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </View>
  );
}

function ToastCard({ toast }: { toast: ToastMessage }) {
  /*
   * RN CONCEPT: Animated, and `useNativeDriver`.
   *
   * With `useNativeDriver: true` the animation is handed to the platform's own animation system and
   * runs on the UI thread, so it stays smooth even while JavaScript is busy parsing a menu
   * response. Only `transform` and `opacity` can be driven natively — animating `height` or
   * `backgroundColor` would have to cross the bridge on every frame, which is exactly the jank the
   * native driver exists to avoid.
   *
   * WHY `useState` AND NOT `useRef`. Most React Native code writes
   * `useRef(new Animated.Value(0)).current`, and it works. But that reads `ref.current` during
   * render, which React 19's `react-hooks/refs` rule rejects — a ref is not meant to be part of
   * rendering, and the React Compiler is entitled to assume it is not. `useState` with a LAZY
   * initialiser gives the same guarantee that matters here (the value is constructed once and
   * never replaced) without lying about what it is. `setEnter` is deliberately never called.
   */
  const [enter] = useState(() => new Animated.Value(0));

  useEffect(() => {
    /*
     * The animation is started in an effect, not during render. Render must be side-effect free:
     * React may render a component twice (StrictMode does exactly that in development), and
     * starting an animation from the render body would start it twice.
     */
    const animation = Animated.timing(enter, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    });
    animation.start();

    // Stop it if the toast is dismissed mid-flight, so it cannot write to a detached node.
    return () => animation.stop();
  }, [enter]);

  return (
    <Animated.View
      style={[
        styles.toast,
        variantStyles[toast.variant],
        {
          opacity: enter,
          // Slide down a few points as it fades in. `interpolate` maps 0→1 onto -8→0.
          transform: [
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
          ],
        },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Text variant="caption" tone="inverse" style={styles.message}>
        {toast.message}
      </Text>
    </Animated.View>
  );
}

/**
 * Consumers call `useToast()` rather than `useContext(ToastContext)`. That hides the context
 * object, gives one place for the "did you forget the provider?" guard, and means the
 * implementation could change without touching a single screen.
 */
export function useToast(): ToastContextValue {
  /*
   * React 19's `use()` replaces `useContext()`. It reads the same value, and unlike useContext it
   * may be called conditionally — which is not needed here, but it is the API going forward.
   */
  const context = use(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used inside a <ToastProvider>');
  }
  return context;
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    gap: theme.spacing.sm,
    // Above the tab bar and any sheet rendered by this tree.
    zIndex: 1000,
  },
  toast: {
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    ...theme.shadow.card,
  },
  message: { fontWeight: theme.fontWeight.semibold },
});

const variantStyles = StyleSheet.create({
  success: { backgroundColor: theme.colors.text },
  danger: { backgroundColor: theme.colors.danger },
  info: { backgroundColor: theme.colors.info },
});
