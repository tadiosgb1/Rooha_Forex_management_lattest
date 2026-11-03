<script setup>
import { useAttrs } from 'vue'
defineOptions({ inheritAttrs: false })
defineProps({ modelValue: { type: [String, Number], default: '' }, label: { type: String, default: '' }, hint: { type: String, default: '' }, error: { type: String, default: '' }, options: { type: Array, default: () => [] }, placeholder: { type: String, default: 'Select an option' }, required: { type: Boolean, default: false }, id: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue', 'change', 'blur'])
const attrs = useAttrs()
</script>
<template>
  <label v-if="label" class="ui-field" :for="id || attrs.id"><span class="ui-field-label">{{ label }} <b v-if="required" class="ui-required">*</b></span>
    <select v-bind="attrs" :id="id || attrs.id" class="ui-select" :class="{ 'is-invalid': error }" :value="modelValue" :required="required" :aria-invalid="!!error" @change="emit('update:modelValue', $event.target.value); emit('change', $event.target.value)" @blur="emit('blur', $event)">
      <option v-if="placeholder" disabled value="">{{ placeholder }}</option><option v-for="option in options" :key="typeof option === 'object' ? option.value : option" :value="typeof option === 'object' ? option.value : option">{{ typeof option === 'object' ? option.label : option }}</option><slot />
    </select><small v-if="error" class="ui-field-error">{{ error }}</small><small v-else-if="hint" class="ui-field-hint">{{ hint }}</small>
  </label>
  <select v-else v-bind="attrs" :id="id || attrs.id" class="ui-select" :class="{ 'is-invalid': error }" :value="modelValue" :required="required" @change="emit('update:modelValue', $event.target.value); emit('change', $event.target.value)"><option v-if="placeholder" disabled value="">{{ placeholder }}</option><option v-for="option in options" :key="typeof option === 'object' ? option.value : option" :value="typeof option === 'object' ? option.value : option">{{ typeof option === 'object' ? option.label : option }}</option><slot /></select>
</template>
