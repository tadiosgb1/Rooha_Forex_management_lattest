<script setup>
defineProps({ size: { type: String, default: 'md', validator: (v) => ['sm', 'md', 'lg'].includes(v) }, label: { type: String, default: 'Loading' }, inline: { type: Boolean, default: false } })
</script>
<template><span class="ui-spinner-wrap" :class="{ 'ui-spinner-wrap--inline': inline }" role="status"><span class="ui-spinner" :class="`ui-spinner--${size}`" aria-hidden="true"></span><span class="ui-spinner-label"><slot>{{ label }}</slot></span></span></template>
