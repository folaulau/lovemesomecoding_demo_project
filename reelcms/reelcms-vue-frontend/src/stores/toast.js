import { defineStore } from "pinia";
import { ref } from "vue";

let nextId = 1;

/** App-wide transient messages. Rendered once by components/ui/AppToast.vue. */
export const useToastStore = defineStore("toast", () => {
  const items = ref([]);

  function push(message, variant = "success", ms = 3600) {
    const id = nextId++;
    items.value.push({ id, message, variant });
    setTimeout(() => dismiss(id), ms);
    return id;
  }

  const success = (m) => push(m, "success");
  // Errors stay up longer - they usually carry something you need to read.
  const error = (m) => push(m, "danger", 6000);
  const info = (m) => push(m, "info");

  function dismiss(id) {
    items.value = items.value.filter((t) => t.id !== id);
  }

  return { items, push, success, error, info, dismiss };
});
