<script setup>
defineProps({ tone: { type: String, default: 'info', validator: (v) => ['info', 'success', 'warning', 'danger'].includes(v) }, title: { type: String, default: '' }, dismissible: { type: Boolean, default: false } })
const emit = defineEmits(['dismiss'])
</script>
<template>
  <div class="ui-alert" :class="`ui-alert--${tone}`" role="status"><span class="ui-alert-mark" aria-hidden="true">{{ tone === 'success' ? '✓' : tone === 'warning' ? '!' : tone === 'danger' ? '×' : 'i' }}</span><div class="ui-alert-content"><strong v-if="title">{{ title }}</strong><div><slot /></div></div><button v-if="dismissible" type="button" class="ui-alert-dismiss" aria-label="Dismiss alert" @click="emit('dismiss')">×</button></div>
</template>
