<script setup>
defineProps({ label: { type: String, default: '' }, orientation: { type: String, default: 'horizontal', validator: (v) => ['horizontal', 'vertical'].includes(v) } })
</script>
<template><div :class="['ui-divider', `ui-divider--${orientation}`]" role="separator" :aria-orientation="orientation"><span v-if="label">{{ label }}</span></div></template>
