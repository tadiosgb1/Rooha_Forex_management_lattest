<script setup>
defineOptions({ inheritAttrs: false })
defineProps({
  as: { type: String, default: 'article', validator: (v) => ['article', 'div', 'button'].includes(v) },
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  detail: { type: String, default: '' },
  valueClass: { type: String, default: '' },
  icon: { type: String, default: '' },
  tone: { type: String, default: 'default', validator: (v) => ['default', 'success', 'warning', 'danger'].includes(v) },
  interactive: { type: Boolean, default: false },
})
</script>
<template>
  <component :is="as" v-bind="$attrs" :type="as === 'button' ? 'button' : undefined" class="ui-stat-card" :class="[`ui-stat-card--${tone}`, { 'ui-stat-card--interactive': interactive }]">
    <div class="ui-stat-card-top"><span v-if="icon" class="ui-stat-card-icon">{{ icon }}</span><span>{{ label }}</span></div>
    <strong :class="valueClass">{{ value }}</strong><small v-if="detail">{{ detail }}</small><slot />
  </component>
</template>
