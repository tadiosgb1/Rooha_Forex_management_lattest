<script setup>
import { useAttrs } from 'vue'
defineOptions({ inheritAttrs: false })
defineProps({
  modelValue: { type: Boolean, default: false },
  label: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  required: { type: Boolean, default: false },
  error: { type: String, default: '' },
  id: { type: String, default: '' },
  name: { type: String, default: '' },
  value: { type: [String, Number, Boolean], default: true },
})
const emit = defineEmits(['update:modelValue', 'change', 'blur', 'focus'])
const attrs = useAttrs()
</script>
<template>
  <div class="ui-checkbox-wrap">
    <label class="ui-checkbox-label" :for="id || attrs.id">
      <input v-bind="attrs" :id="id || attrs.id" class="ui-checkbox" type="checkbox" :name="name || attrs.name" :value="value" :checked="modelValue" :disabled="disabled" :required="required" :aria-invalid="!!error" @change="emit('update:modelValue', $event.target.checked); emit('change', $event.target.checked)" @blur="emit('blur', $event)" @focus="emit('focus', $event)" />
      <span><slot>{{ label }}</slot></span>
    </label>
    <small v-if="error" class="ui-field-error">{{ error }}</small>
  </div>
</template>
