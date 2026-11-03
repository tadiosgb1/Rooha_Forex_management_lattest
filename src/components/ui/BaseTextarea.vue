<script setup>
import { useAttrs } from 'vue'
defineOptions({ inheritAttrs: false })
const props = defineProps({ modelValue: { type: String, default: '' }, label: { type: String, default: '' }, hint: { type: String, default: '' }, error: { type: String, default: '' }, rows: { type: Number, default: 3 }, required: { type: Boolean, default: false }, id: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue', 'blur', 'focus'])
const attrs = useAttrs()
</script>
<template>
  <label v-if="label" class="ui-field" :for="id || attrs.id">
    <span class="ui-field-label">{{ label }} <b v-if="required" class="ui-required">*</b></span>
    <textarea v-bind="attrs" :id="id || attrs.id" class="ui-textarea" :class="{ 'is-invalid': error }" :value="modelValue" :rows="rows" :required="required" :aria-invalid="!!error" @input="emit('update:modelValue', $event.target.value)" @blur="emit('blur', $event)" @focus="emit('focus', $event)"></textarea>
    <small v-if="error" class="ui-field-error">{{ error }}</small><small v-else-if="hint" class="ui-field-hint">{{ hint }}</small>
  </label>
  <textarea v-else v-bind="attrs" :id="id || attrs.id" class="ui-textarea" :class="{ 'is-invalid': error }" :value="modelValue" :rows="rows" :required="required" :aria-invalid="!!error" @input="emit('update:modelValue', $event.target.value)" @blur="emit('blur', $event)" @focus="emit('focus', $event)"></textarea>
</template>
