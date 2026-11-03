<script setup>
defineProps({ title: { type: String, required: true }, subtitle: { type: String, default: '' } })
</script>
<template><header class="ui-page-header"><div class="ui-page-header-copy"><h1>{{ title }}</h1><p v-if="subtitle">{{ subtitle }}</p></div><div v-if="$slots.actions" class="ui-page-header-actions"><slot name="actions" /></div></header></template>
