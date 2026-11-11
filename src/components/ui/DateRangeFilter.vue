<script setup>
import { computed, ref } from 'vue'
const props = defineProps({ modelValue: { type: Object, default: () => ({ preset: '30' }) } })
const emit = defineEmits(['update:modelValue'])
const presets = [{ value: 'today', label: 'Today' }, { value: '7', label: '7 days' }, { value: '14', label: '14 days' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }]
const customOpen = ref(false)
function localDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
function selectPreset(preset) {
  customOpen.value = false
  emit('update:modelValue', { preset })
}
function selectCustom(field, value) {
  const current = props.modelValue?.preset === 'custom' ? { ...props.modelValue } : { preset: 'custom', from: localDate(new Date()), to: localDate(new Date()) }
  current[field] = value
  current.preset = 'custom'
  emit('update:modelValue', current)
}
const from = computed(() => props.modelValue?.from || localDate(new Date()))
const to = computed(() => props.modelValue?.to || localDate(new Date()))
</script>

<template>
  <div class="date-range-filter">
    <div class="date-range-presets" aria-label="Filter by date range">
      <button v-for="item in presets" :key="item.value" type="button" :class="{ active: (modelValue?.preset || '30') === item.value }" @click="selectPreset(item.value)">{{ item.label }}</button>
      <button type="button" class="date-range-calendar" :class="{ active: modelValue?.preset === 'custom' || customOpen }" aria-label="Choose specific date range" title="Choose specific date range" @click="customOpen = !customOpen"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg></button>
    </div>
    <div v-if="customOpen || modelValue?.preset === 'custom'" class="date-range-custom">
      <label>From <input type="date" :value="from" :max="to" @change="selectCustom('from', $event.target.value)" /></label>
      <label>To <input type="date" :value="to" :min="from" @change="selectCustom('to', $event.target.value)" /></label>
    </div>
  </div>
</template>

<style scoped>
.date-range-filter{display:flex;flex-direction:column;align-items:flex-end;gap:9px}.date-range-presets{display:flex;align-items:center;gap:5px;flex-wrap:wrap}.date-range-presets button{height:34px;padding:0 11px;border:1px solid var(--border-color,#dce3ec);border-radius:7px;background:var(--surface-color,#fff);color:var(--text-muted,#758398);font-size:12px;font-weight:650;cursor:pointer}.date-range-presets button.active{border-color:var(--brand-base-color,#178477);background:color-mix(in srgb,var(--brand-base-color,#178477) 9%,var(--surface-color,#fff));color:var(--brand-base-color,#178477)}.date-range-presets .date-range-calendar{width:36px;padding:0;display:grid;place-items:center}.date-range-calendar svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.date-range-custom{display:flex;gap:10px;padding:10px 12px;border:1px solid var(--border-color,#dce3ec);border-radius:8px;background:var(--surface-color,#fff)}.date-range-custom label{display:flex;align-items:center;gap:7px;color:var(--text-muted,#758398);font-size:11px;font-weight:650}.date-range-custom input{height:32px;max-width:145px;border:1px solid var(--border-color,#dce3ec);border-radius:6px;padding:0 7px;color:var(--text-color,#26384d);background:var(--surface-color,#fff)}@media(max-width:640px){.date-range-filter{align-items:flex-start;width:100%}.date-range-custom{flex-wrap:wrap}.date-range-presets button{padding:0 8px}}
</style>
