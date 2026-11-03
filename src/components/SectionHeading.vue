<script setup>
defineProps({
  eyebrow: { type: String, default: '' },
  title: { type: String, required: true },
  description: { type: String, default: '' },
})
</script>

<template>
  <header class="section-heading">
    <p v-if="eyebrow" class="section-heading__eyebrow">{{ eyebrow }}</p>
    <div class="section-heading__content">
      <div>
        <h1 class="section-heading__title">{{ title }}</h1>
        <p v-if="description" class="section-heading__description">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="section-heading__actions">
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>

<style scoped>
.section-heading { display: grid; gap: .5rem; margin-bottom: 1.5rem; }
.section-heading__eyebrow { margin: 0; color: #64748b; font-size: .72rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
.section-heading__content { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.section-heading__title { margin: 0; color: #172033; font-size: clamp(1.5rem, 3vw, 2rem); font-weight: 700; }
.section-heading__description { margin: .5rem 0 0; color: #64748b; line-height: 1.6; }
.section-heading__actions { display: flex; align-items: center; gap: .75rem; }
</style>
