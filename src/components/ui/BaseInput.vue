<script setup>
import { computed, useAttrs } from 'vue'
defineOptions({ inheritAttrs: false })
const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  label: { type: String, default: '' },
  hint: { type: String, default: '' },
  error: { type: String, default: '' },
  id: { type: String, default: '' },
  type: { type: String, default: 'text' },
  size: { type: String, default: 'md', validator: (v) => ['sm', 'md', 'lg'].includes(v) },
  required: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'blur', 'focus'])
const attrs = useAttrs()
const fieldId = computed(() => props.id || attrs.id || undefined)
</script>
<template>
  <label v-if="label" class="ui-field" :for="fieldId">
    <span class="ui-field-label">{{ label }} <b v-if="required" class="ui-required">*</b></span>
    <input v-bind="attrs" :id="fieldId" class="ui-input" :class="[`ui-input--${size}`, { 'is-invalid': error }]" :type="type" :value="modelValue" :required="required" :aria-invalid="!!error" @input="emit('update:modelValue', type === 'number' && $event.target.value !== '' ? Number($event.target.value) : $event.target.value)" @blur="emit('blur', $event)" @focus="emit('focus', $event)" />
    <small v-if="error" class="ui-field-error">{{ error }}</small><small v-else-if="hint" class="ui-field-hint">{{ hint }}</small>
  </label>
  <input v-else v-bind="attrs" :id="fieldId" class="ui-input" :class="[`ui-input--${size}`, { 'is-invalid': error }]" :type="type" :value="modelValue" :required="required" :aria-invalid="!!error" @input="emit('update:modelValue', type === 'number' && $event.target.value !== '' ? Number($event.target.value) : $event.target.value)" @blur="emit('blur', $event)" @focus="emit('focus', $event)" />
</template>
