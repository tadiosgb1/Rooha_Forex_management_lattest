<script setup>
defineProps({ title: { type: String, default: 'Nothing here yet' }, description: { type: String, default: '' }, icon: { type: String, default: '—' } })
</script>
<template><div class="ui-empty-state"><span class="ui-empty-icon" aria-hidden="true">{{ icon }}</span><h3>{{ title }}</h3><p v-if="description">{{ description }}</p><div v-if="$slots.default" class="ui-empty-actions"><slot /></div></div></template>
