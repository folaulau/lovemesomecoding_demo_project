import { onBeforeUnmount, onMounted, ref, unref } from "vue";

/*
 * IntersectionObserver, wrapped so a component cannot forget to disconnect it.
 *
 * VUE CONCEPT: this is a composable — a plain function that uses Vue's reactivity
 * and lifecycle APIs, named `useX` by convention. It is the Composition API's
 * answer to sharing logic between components, and it replaced Vue 2's mixins.
 *
 * The three things that make it one, rather than just a utility function:
 *
 *   1. It calls `onMounted` / `onBeforeUnmount`. Those only work when called
 *      synchronously from a component's setup, which is why a composable must
 *      be called at the top level of `<script setup>` and never inside a
 *      callback or an `if`.
 *   2. It OWNS its cleanup. The caller never sees the observer and cannot leak
 *      it. Every composable that starts something is responsible for stopping it.
 *   3. It returns refs and functions, not a snapshot of values, so the caller
 *      keeps reactivity.
 *
 * `root` may be a ref (a template ref, usually) or a plain element — `unref`
 * accepts either, which is the normal way a composable stays flexible about how
 * it is called.
 */
export function useIntersectionObserver(onIntersect, { root = null, threshold = 0 } = {}) {
  let observer = null;

  // Elements registered before mount. A template ref inside a v-for is not
  // populated until the DOM exists, but the caller should not have to care about
  // that ordering, so they are buffered and observed once the observer is built.
  const pending = new Set();

  const isActive = ref(false);

  onMounted(() => {
    observer = new IntersectionObserver(onIntersect, {
      // unref() so the caller can pass either `scroller` (a ref) or an element.
      root: unref(root) ?? null,
      threshold,
    });
    isActive.value = true;
    pending.forEach((el) => observer.observe(el));
    pending.clear();
  });

  /** Watch an element. Safe to call with null, and safe to call twice —
   *  re-observing an element already under observation is a no-op. */
  function observe(el) {
    if (!el) return;
    if (observer) observer.observe(el);
    else pending.add(el);
  }

  function unobserve(el) {
    if (!el) return;
    pending.delete(el);
    observer?.unobserve(el);
  }

  function stop() {
    observer?.disconnect();
    observer = null;
    pending.clear();
    isActive.value = false;
  }

  // The whole point. A component using this cannot leak an observer, because
  // the composable that created it is the thing that tears it down.
  onBeforeUnmount(stop);

  return { observe, unobserve, stop, isActive };
}
