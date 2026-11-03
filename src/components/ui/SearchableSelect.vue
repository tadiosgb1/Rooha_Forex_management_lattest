<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Search options…' },
  required: { type: Boolean, default: false },
  ariaLabel: { type: String, default: 'Search and select an option' },
})
const emit = defineEmits(['update:modelValue', 'focus', 'search'])
const query = ref('')
const open = ref(false)
const filteredOptions = computed(() => {
  const term = query.value.trim().toLocaleLowerCase()
  if (!term) return props.options.slice(0, 100)
  return props.options.filter(option => String(option.label ?? '').toLocaleLowerCase().includes(term)).slice(0, 100)
})
function selectedOption() {
  return props.options.find(option => String(option.value) === String(props.modelValue))
}
watch(() => [props.modelValue, props.options], () => {
  const selected = selectedOption()
  if (selected) query.value = selected.label
  else if (!props.modelValue) query.value = ''
}, { immediate: true, deep: true })
function onInput(value) {
  query.value = value
  open.value = true
  emit('search', value)
  const selected = selectedOption()
  if (!selected || selected.label !== value) emit('update:modelValue', '')
}
function choose(option) {
  query.value = option.label
  emit('update:modelValue', String(option.value))
  open.value = false
}
function onBlur() {
  const selected = selectedOption()
  query.value = selected?.label ?? ''
  open.value = false
}
</script>

<template>
  <div class="searchable-select">
    <input
      :value="query"
      class="ui-input"
      type="text"
      :placeholder="placeholder"
      :required="required && !modelValue"
      :aria-label="ariaLabel"
      :aria-expanded="open"
      autocomplete="off"
      role="combobox"
      aria-autocomplete="list"
      @focus="open = true; emit('focus')"
      @input="onInput($event.target.value)"
      @blur="onBlur"
      @keydown.esc="open = false"
      @keydown.down.prevent="open = true"
    />
    <div v-if="open && filteredOptions.length" class="searchable-select-menu" role="listbox">
      <button
        v-for="option in filteredOptions"
        :key="String(option.value)"
        type="button"
        class="searchable-select-option"
        role="option"
        :aria-selected="String(option.value) === String(modelValue)"
        @mousedown.prevent="choose(option)"
      >{{ option.label }}</button>
    </div>
    <div v-else-if="open && query.trim()" class="searchable-select-empty">No matching options</div>
  </div>
</template>

<style scoped>
.searchable-select{position:relative;width:100%}
.searchable-select .ui-input{width:100%}
.searchable-select-menu,.searchable-select-empty{position:absolute;z-index:30;top:calc(100% + 4px);left:0;right:0;max-height:240px;overflow-y:auto;background:var(--white,#fff);border:1px solid var(--line,#e4e9ef);border-radius:8px;box-shadow:0 8px 24px rgba(15,32,50,.14)}
.searchable-select-option{display:block;width:100%;padding:10px 12px;text-align:left;background:transparent;color:var(--ink,#172536);border:0;cursor:pointer}
.searchable-select-option:hover,.searchable-select-option[aria-selected="true"]{background:var(--blue2,#eaf2ff)}
.searchable-select-empty{padding:12px;color:var(--muted,#718096)}
</style>
