<script setup>
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
const route = useRoute()
const router = useRouter()
onMounted(() => router.replace(`/vault/${encodeURIComponent(route.params.id)}`))
</script>
<template><section class="module-page"><p class="module-description">Opening the cash movement record…</p></section></template>
