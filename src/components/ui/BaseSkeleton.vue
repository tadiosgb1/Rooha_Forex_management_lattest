<script setup>
defineProps({ variant: { type: String, default: 'text', validator: (v) => ['text', 'title', 'avatar', 'card', 'button'].includes(v) }, width: { type: String, default: '' }, height: { type: String, default: '' }, rounded: { type: Boolean, default: false } })
</script>
<template><span class="ui-skeleton" :class="[`ui-skeleton--${variant}`, { 'ui-skeleton--rounded': rounded }]" :style="{ width: width || undefined, height: height || undefined }" aria-hidden="true"></span></template>
