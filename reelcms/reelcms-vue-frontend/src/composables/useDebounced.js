import { onBeforeUnmount, ref, unref, watch } from "vue";

/*
 * A ref that trails `source`, updating only once it has stopped changing for
 * `delay` milliseconds.
 *
 * Search-as-you-type without this fires a request per keystroke: typing
 * "buzzer" is six searches, five of which are already stale before they come
 * back. Debouncing turns it into one.
 *
 * VUE CONCEPT: the argument is a ref OR a getter, not a value.
 *
 *   useDebounced(term)                 <- a ref
 *   useDebounced(() => route.query.q)  <- a getter
 *
 * Passing `term.value` instead would hand over a plain string, and the composable
 * would have nothing to watch — it would debounce one value, once, forever. This
 * is the single most common mistake with composables, and it fails silently:
 * everything renders, the value simply never updates again.
 *
 * `watch` accepts a ref or a getter directly, which is why both forms work here
 * with no branching.
 */
export function useDebounced(source, delay = 300) {
  const debounced = ref(typeof source === "function" ? source() : unref(source));
  let timer = null;

  watch(source, (value) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      debounced.value = value;
    }, delay);
  });

  // Without this, a timer that fires after the component is gone writes to a ref
  // nothing is rendering any more. Harmless here; not harmless when the callback
  // starts a request.
  onBeforeUnmount(() => clearTimeout(timer));

  // Returned READONLY by convention: the caller reads it and writes to `source`.
  // Returning a writable ref invites two sources of truth for the same value.
  return debounced;
}
