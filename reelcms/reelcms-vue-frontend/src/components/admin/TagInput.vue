<script setup>
import { ref } from "vue";
import { slugify } from "../../utils/format";

/* Chip-style tag editor. Tags are slugified on entry because they are queried
   with an exact match against a multikey index - "Buzzer Beater" and
   "buzzer-beater" would otherwise be two different tags that look identical in
   a list. */

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  max: { type: Number, default: 8 },
});
const emit = defineEmits(["update:modelValue"]);

const draft = ref("");

function add() {
  const tag = slugify(draft.value);
  draft.value = "";
  if (!tag || props.modelValue.includes(tag) || props.modelValue.length >= props.max) return;
  emit("update:modelValue", [...props.modelValue, tag]);
}

function remove(tag) {
  emit("update:modelValue", props.modelValue.filter((t) => t !== tag));
}

/** Backspace on an empty box removes the last chip - standard for this control. */
function onBackspace() {
  if (draft.value === "" && props.modelValue.length) {
    emit("update:modelValue", props.modelValue.slice(0, -1));
  }
}
</script>

<template>
  <div>
    <div class="d-flex flex-wrap gap-1 mb-2" v-if="modelValue.length">
      <span v-for="tag in modelValue" :key="tag" class="tag-chip">
        #{{ tag }}
        <button
          type="button"
          class="btn-close btn-close-white ms-1"
          style="font-size: 0.55rem"
          :aria-label="`Remove ${tag}`"
          @click="remove(tag)"
        ></button>
      </span>
    </div>
    <input
      v-model="draft"
      class="form-control form-control-sm"
      :placeholder="modelValue.length >= max ? `Maximum ${max} tags` : 'Type a tag and press Enter'"
      :disabled="modelValue.length >= max"
      @keydown.enter.prevent="add"
      @keydown.,.prevent="add"
      @keydown.delete="onBackspace"
      @blur="add"
    />
    <div class="form-text">{{ modelValue.length }} / {{ max }} · lowercased and hyphenated automatically</div>
  </div>
</template>
