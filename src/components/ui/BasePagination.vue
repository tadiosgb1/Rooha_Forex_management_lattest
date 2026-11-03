<script setup>
import BaseButton from './BaseButton.vue'
const props = defineProps({ page: { type: Number, default: 1 }, totalPages: { type: Number, default: 1 }, disabled: { type: Boolean, default: false } })
const emit = defineEmits(['update:page', 'change'])
function go(next) { const page = Math.max(1, Math.min(props.totalPages, next)); if (page !== props.page) { emit('update:page', page); emit('change', page) } }
</script>
<template><nav class="ui-pagination" aria-label="Pagination"><span class="ui-pagination-summary">Page {{ page }} of {{ Math.max(1, totalPages) }}</span><div class="ui-pagination-actions"><BaseButton variant="secondary" size="sm" :disabled="disabled || page <= 1" aria-label="First page" @click="go(1)">«</BaseButton><BaseButton variant="secondary" size="sm" :disabled="disabled || page <= 1" aria-label="Previous page" @click="go(page - 1)">‹</BaseButton><BaseButton variant="secondary" size="sm" :disabled="disabled || page >= totalPages" aria-label="Next page" @click="go(page + 1)">›</BaseButton><BaseButton variant="secondary" size="sm" :disabled="disabled || page >= totalPages" aria-label="Last page" @click="go(totalPages)">»</BaseButton></div></nav></template>
