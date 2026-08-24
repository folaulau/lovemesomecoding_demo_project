import { useCallback, useEffect, useState } from 'react';
import { profileApi, toUserMessage } from '@/api';
import type { Address, PaymentMethod } from '@/types';

/**
 * Loads and re-loads the two lists the profile screen shows.
 *
 * <p>A custom hook, not a context: nothing outside this screen needs addresses or saved cards, so
 * putting them in a provider would keep them in memory for the whole session and re-render
 * unrelated screens when they change. A hook keeps the state with the screen that owns it.
 */
export function useProfileData() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /*
   * A counter, not a boolean. Incrementing it re-runs the effect, so the first load and every
   * post-write refresh go through one code path.
   */
  const [reloadToken, setReloadToken] = useState(0);

  /*
   * The fetch lives INSIDE the effect. A function hoisted out and called from here reads, to the
   * linter and to the React Compiler, as a synchronous call that sets state — the cascading render
   * `react-hooks/set-state-in-effect` exists to prevent. Inline, the AbortController stays in
   * scope and there is no dependency array to get wrong.
   */
  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        // Independent requests, so they go in parallel rather than one after the other.
        const [savedAddresses, savedCards] = await Promise.all([
          profileApi.listAddresses(controller.signal),
          profileApi.listPaymentMethods(controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setAddresses(savedAddresses);
        setPaymentMethods(savedCards);
        setError(null);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(toUserMessage(err, 'Could not load your profile.'));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [reloadToken]);

  /** Called after any write, so the screen always shows what the server actually stored. */
  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return { addresses, paymentMethods, loading, error, reload };
}
