<script setup>
import { useRouter } from 'vue-router'
import BaseButton from '../components/ui/BaseButton.vue'

const router = useRouter()
</script>

<template>
  <main class="not-found-page">
    <p class="eyebrow">404 · PAGE NOT FOUND</p>
    <h1>This page isn't available</h1>
    <p>The address may be incorrect or the page may have moved.</p>
    <BaseButton variant="primary" type="button" @click="router.push('/')">Return to dashboard</BaseButton>
  </main>
</template>

<style scoped>
.not-found-page { max-width: 38rem; margin: 12vh auto; padding: 2rem; color: #172033; }
.eyebrow { color: #64748b; font-size: .75rem; font-weight: 700; letter-spacing: .12em; }
h1 { margin: .75rem 0; font-size: clamp(2rem, 5vw, 3rem); }
.not-found-page > p:not(.eyebrow) { color: #64748b; line-height: 1.6; margin-bottom: 1.5rem; }
</style>
